"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { apiGet, apiPost } from "@/app/lib/api";
import type { Product } from "@/app/types/entities";

type CartItem = {
  key: string;
  product_id: number;
  name: string;
  size: string;
  sugar: string;
  qty: number;
  price: number; // unit price
  image?: string | null;
};

const IMAGE_BASE = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "";

const sugarOptions = [
  { label: "No sweet", value: "no sweet" },
  { label: "Less", value: "less" },
  { label: "Normal", value: "normal" },
  { label: "More", value: "more" },
];

export default function CustomerMenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [tableNo, setTableNo] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  // ===== Bakong QR States =====
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [payStatus, setPayStatus] = useState<"idle" | "pending" | "paid" | "expired" | "failed">("idle");
  const [payRef, setPayRef] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await apiGet<any>("/products");
        setProducts(p.data ?? p);
      } catch (e: any) {
        setToast(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [products, search]);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  function addToCart(p: Product, size: string, sugar: string) {
    const v = p.variants.find((x) => x.size === size);
    if (!v) return;

    const key = `${p.id}|${size}|${sugar}`;
    setCart((prev) => {
      const found = prev.find((x) => x.key === key);
      if (found) return prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x));
      return [
        ...prev,
        {
          key,
          product_id: p.id,
          name: p.name,
          size,
          sugar,
          qty: 1,
          price: Number(v.price),
          image: p.image ?? null,
        },
      ];
    });

    setToast(`Added: ${p.name} (${size})`);
  }

  function inc(key: string) {
    setCart((prev) => prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)));
  }
  function dec(key: string) {
    setCart((prev) => prev.map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)));
  }
  function remove(key: string) {
    setCart((prev) => prev.filter((x) => x.key !== key));
  }

  // ===== Bakong KHQR Flow =====
  async function placeOrder() {
    if (!cart.length) return setToast("Cart is empty.");

    setSubmitting(true);
    try {
      const payload = {
        table_no: tableNo,
        note,
        items: cart.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          size: it.size,
          sugar: it.sugar,
          qty: it.qty,
          price: it.price,
        })),
      };

      // 1) Create KHQR on backend (backend also creates order + payment)
      const created = await apiPost<{
        payment_id: number;
        order_id: number;
        order_ref: string;
        amount: number;
        currency: string;
        qr_string: string;
        expires_at: string;
      }>("/bakong/khqr/create", payload);

      setPayRef(created.order_ref);
      setPayStatus("pending");

      // 2) Convert KHQR string to QR image
      const url = await QRCode.toDataURL(created.qr_string, { margin: 1, scale: 7 });
      setQrDataUrl(url);
      setQrOpen(true);

      // 3) Poll payment status
      const paymentId = created.payment_id;
      const startedAt = Date.now();

      const poll = async () => {
        try {
          const s = await apiGet<{ status: "pending" | "paid" | "expired" | "failed" }>(
            `/bakong/khqr/status/${paymentId}`
          );

          if (s.status === "paid") {
            setPayStatus("paid");

            setTimeout(() => {
              setQrOpen(false);
              setQrDataUrl(null);
              setPayStatus("idle");
              setPayRef(null);

              setCart([]);
              setNote("");
              setToast("Payment success ✅ Order success ✅");
            }, 800);

            return;
          }

          if (s.status === "expired" || s.status === "failed") {
            setPayStatus(s.status);
            return;
          }

          if (Date.now() - startedAt < 10 * 60 * 1000) {
            setTimeout(poll, 2000);
          } else {
            setPayStatus("expired");
          }
        } catch {
          setTimeout(poll, 2500);
        }
      };

      poll();
    } catch (e: any) {
      setToast(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#059669]">
      {/* Toast */}
      {toast ? (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm rounded-xl bg-[#4f2206] px-4 py-3 text-sm text-white shadow-lg"
          onClick={() => setToast(null)}
        >
          {toast}
        </div>
      ) : null}

      {/* ===== KHQR Modal ===== */}
      {qrOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-[#4f2206]">Scan to Pay (Bakong)</div>
                {payRef ? <div className="mt-1 text-xs text-gray-600">Order: {payRef}</div> : null}
              </div>

              <button
                className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/5"
                onClick={() => {
                  setQrOpen(false);
                  setQrDataUrl(null);
                  setPayStatus("idle");
                  setPayRef(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-gray-50 p-4 flex items-center justify-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="KHQR" className="h-56 w-56" />
              ) : (
                <div className="text-sm text-gray-600">Generating QR...</div>
              )}
            </div>

            <div className="mt-4">
              {payStatus === "pending" ? (
                <div className="rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
                  Waiting for payment...
                </div>
              ) : null}

              {payStatus === "paid" ? (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                  Payment success ✅
                </div>
              ) : null}

              {payStatus === "expired" ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  QR expired. Please try again.
                </div>
              ) : null}

              {payStatus === "failed" ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  Payment check failed. Please try again.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="rounded-3xl bg-[#064e4d] p-6 shadow-sm border border-black/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-gray-900">Search</div>
                <input
                  className="w-full rounded-xl border border-black/10 bg-gray-300 text-black px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
                  placeholder="Iced Latte..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-gray-900">Table No</div>
                <input
                  className="w-full rounded-xl border border-black/10 bg-gray-300 text-black px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Products */}
          <div className="rounded-3xl ">
            <div className="mb-3 flex items-center justify-between rounded-xl bg-[#042f2e] p-2 w-full">
              <div className="font-bold text-white text-xl">Menu</div>
              <div className="text-sm text-gray-600">{filtered.length} items</div>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-600">
                No products found.
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {filtered.map((p) => (
                  <MenuCard key={p.id} product={p} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-black/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold text-[#4f2206]">Your Order</div>
                <div className="text-sm text-gray-600">{cart.reduce((s, it) => s + it.qty, 0)} items</div>
              </div>
              <button
                className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-[#4f2206] hover:bg-black/5"
                onClick={() => setCart([])}
              >
                Clear
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-600">
                  Cart is empty.
                </div>
              ) : (
                cart.map((it) => (
                  <div key={it.key} className="rounded-2xl bg-[#f6efe8] p-4 border border-black/5">
                    <div className="flex gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-white border border-black/5">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${IMAGE_BASE}/${it.image}`} alt={it.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>

                      <div className="flex-1">
                        <div className="font-bold text-[#4f2206]">{it.name}</div>
                        <div className="text-xs text-black">
                          Size: <span className="font-semibold">{it.size}</span> • Sugar:{" "}
                          <span className="font-semibold">{it.sugar}</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-sm font-bold text-[#4f2206]">${it.price.toFixed(2)}</div>

                          <div className="flex items-center gap-2">
                            <QtyBtn onClick={() => dec(it.key)}>-</QtyBtn>
                            <div className="w-8 text-center font-bold">{it.qty}</div>
                            <QtyBtn onClick={() => inc(it.key)}>+</QtyBtn>
                            <button
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              onClick={() => remove(it.key)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-gray-900">Note (optional)</div>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="less ice, no straw..."
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-black/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-600">Subtotal</div>
                <div className="font-extrabold text-[#4f2206]">${subtotal.toFixed(2)}</div>
              </div>

              <button
                className="mt-3 w-full rounded-2xl bg-[#4f2206] px-4 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
                disabled={submitting || cart.length === 0}
                onClick={placeOrder}
              >
                {submitting ? "Placing order..." : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QtyBtn({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      className="h-9 w-9 rounded-xl border border-black/10 bg-white font-extrabold text-[#4f2206] hover:bg-black/5"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product, size: string, sugar: string) => void;
}) {
  const [size, setSize] = useState(product.variants?.[0]?.size || "regular");
  const [sugar, setSugar] = useState("normal");

  const price = product.variants.find((v) => v.size === size)?.price ?? 0;

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-24 w-24 overflow-hidden rounded-2xl bg-[#f3e7dd] border border-black/5">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${IMAGE_BASE}/${product.image}`} alt={product.name} className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="flex-1">
          <div className="font-extrabold text-[#4f0610]">{product.name}</div>
          <div className="mt-1 text-sm font-bold text-[#a71237]">${Number(price).toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-sm font-medium text-gray-900">Size</div>
          <select
            className="w-full rounded-xl border text-black border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.size} value={v.size}>
                {v.size}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-sm font-medium text-gray-900">Sugar</div>
          <select
            className="w-full rounded-xl border border-black/10 bg-white px-3 text-black py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
            value={sugar}
            onChange={(e) => setSugar(e.target.value)}
          >
            {sugarOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="mt-3 w-full rounded-2xl bg-[#4f2206] px-4 py-3 text-sm font-extrabold text-white hover:opacity-95"
        onClick={() => onAdd(product, size, sugar)}
      >
        + Add
      </button>
    </div>
  );
}
