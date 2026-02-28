"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/app/lib/api";
import type { Product } from "@/app/types/entities";
import { KhqrCard } from "@/components/KhqrCard";

type CartItem = {
  key: string;
  product_id: number;
  name: string;
  size: string;
  sugar: string;
  qty: number;
  price: number;
  image?: string | null;
};

type CreatedOrder = {
  id: number;
  reference: string;
  total: number | string;
  status?: string;
};

type KhqrResp = {
  order_id: number;
  reference: string;
  amount: number;
  currency: string;
  payment_id?: number;
  expires_at: string;
  qr_string: string;
  md5?: string;
  full_hash?: string;
};

type PayStatusResp = {
  paid: boolean;
  status?: string;
  payment_status?: string;
  paid_at?: string | null;
  bakong?: any;
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

  // Cart drawer
  const [cartOpen, setCartOpen] = useState(false);

  // Payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [khqr, setKhqr] = useState<KhqrResp | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  // timers
  const pollRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Auto-hide toast (so "payment success" doesn't stick forever)
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await apiGet<any>("/products");
        setProducts(p.data ?? p);
      } catch (e: any) {
        setToast(e?.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [products, search]);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

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

    // setToast(`Added: ${p.name} (${size})`);
  }

  function inc(key: string) {
    setCart((prev) => prev.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)));
  }

  function dec(key: string) {
    setCart((prev) =>
      prev.map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty - 1) } : x))
    );
  }

  function remove(key: string) {
    setCart((prev) => prev.filter((x) => x.key !== key));
  }

  // ---- timers ----
  function stopPolling() {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function stopExpireTimer() {
    if (expireRef.current) {
      window.clearTimeout(expireRef.current);
      expireRef.current = null;
    }
  }

  function stopTicker() {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  function startTicker() {
    stopTicker();
    tickerRef.current = window.setInterval(() => setNowTick(Date.now()), 1000);
  }

  function secondsLeft(expiresAt?: string) {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - nowTick;
    return Math.max(0, Math.floor(ms / 1000));
  }

  function startExpireTimer(expiresAtIso: string) {
    if (!expiresAtIso) return;

    stopExpireTimer();

    const msLeft = new Date(expiresAtIso).getTime() - Date.now();

    if (msLeft <= 0) {
      setToast("QR expired ❌");
      closePayModal();
      return;
    }

    expireRef.current = window.setTimeout(() => {
      setToast("QR expired ❌");
      closePayModal();
    }, msLeft);
  }

  function closePayModal() {
    stopPolling();
    stopExpireTimer();
    stopTicker();

    setPayOpen(false);
    setPayLoading(false);
    setPayError(null);
    setKhqr(null);
    setCreatedOrder(null);
  }

  async function checkPaymentOnce(orderId: number) {
    try {
      const status = await apiGet<PayStatusResp>(`/orders/${orderId}/bakong/status`);

      const paid =
        Boolean(status?.paid) ||
        status?.status === "paid" ||
        status?.payment_status === "paid" ||
        Boolean(status?.paid_at) ||
        (status as any)?.bakong?.responseCode === 0;

      if (paid) {
        setToast("Payment success ✅ Order confirmed");
        stopPolling();
        stopExpireTimer();
        stopTicker();

        // Clear cart after paid
        setCart([]);
        setNote("");

        // Close modal shortly
        window.setTimeout(() => closePayModal(), 600);
        return true;
      }

      return false;
    } catch {
      // ignore polling errors
      return false;
    }
  }

  async function startPolling(orderId: number) {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      await checkPaymentOnce(orderId);
    }, 2000);
  }

  async function placeOrder() {
    if (!cart.length) return setToast("Cart is empty.");

    // Close cart drawer when placing order
    setCartOpen(false);

    setSubmitting(true);
    setPayError(null);

    try {
      // 1) Create order
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

      const created = await apiPost<CreatedOrder>("/orders", payload);
      setCreatedOrder(created);

      // 2) Generate KHQR
      setPayOpen(true);
      setPayLoading(true);

      const khqrResp = await apiPost<KhqrResp>(`/orders/${created.id}/bakong/khqr`, {
        table_no: tableNo,
      });

      if (!khqrResp?.qr_string) throw new Error("Backend did not return qr_string");

      setKhqr(khqrResp);
      setPayLoading(false);

      // timers
      startExpireTimer(khqrResp.expires_at);
      startTicker();

      // check immediately then poll
      await checkPaymentOnce(created.id);
      await startPolling(created.id);
    } catch (e: any) {
      setPayLoading(false);
      setPayError(e?.message || "Place order / KHQR failed");
      setToast(e?.message || "Place order / KHQR failed");
    } finally {
      setSubmitting(false);
    }
  }

  const left = secondsLeft(khqr?.expires_at);

  return (
    <div className="min-h-screen bg-[#059669]">
      {/* Toast */}
      {toast ? (
        <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl bg-[#4f2206] px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Floating Cart Button + badge */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#042f2e] text-white shadow-lg hover:opacity-95"
        aria-label="Open cart"
      >
        {/* cart icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-7 w-7"
        >
          <path d="M7 4a1 1 0 0 1 .97.757L8.28 6H20a1 1 0 0 1 .96 1.274l-2 7A1 1 0 0 1 18 15H9a1 1 0 0 1-.96-.726L6.24 6.5 5.22 3H3a1 1 0 1 1 0-2h3a1 1 0 0 1 .97.757L7 4Zm2.18 9H17.2l1.43-5H8.54l.64 2.48Z" />
          <path d="M9 22a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm9 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
        </svg>

        {cartCount > 0 ? (
          <span className="absolute -top-2 -right-2 min-w-[22px] rounded-full bg-red-600 px-2 py-[2px] text-center text-xs font-extrabold leading-none">
            {cartCount}
          </span>
        ) : null}
      </button>

      {/* Cart Drawer */}
      {cartOpen ? (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />

          {/* panel */}
          <div className="absolute right-0 top-0 h-full w-full md:max-w-[420px]  bg-[#042f2e] shadow-2xl">
            <div className="flex items-center justify-between  border-b border-black/10 p-4">
              <div>
                <div className="text-lg font-extrabold text-white">Your Order</div>
                <div className="text-sm text-white">{cartCount} items</div>
              </div>

              <button
                className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold bg-[#059669] text-white hover:bg-black/5"
                onClick={() => setCartOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="h-[calc(100%-64px)] overflow-y-auto p-6">
              <div className="flex items-center justify-between">
                <button
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-white bg-[#059669] hover:bg-black/5"
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
                            <img
                              src={`${IMAGE_BASE}/${it.image}`}
                              alt={it.name}
                              className="h-full w-full object-cover"
                            />
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
                  <div className="mb-1 text-sm text-white font-bold">Note (optional)</div>
                  <input
                    className="w-full rounded-xl border border-black/10 bg-gray-300 text-black px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#99613f]/30"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="less ice, no straw..."
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border bg-[#059669] border-black/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-white font-bold">Subtotal</div>
                  <div className="font-bold text-red-600">${subtotal.toFixed(2)}</div>
                </div>

                <button
                  className="mt-3 w-full rounded-2xl bg-[#042f2e] px-4 py-3 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
                  disabled={submitting || cart.length === 0}
                  onClick={placeOrder}
                >
                  {submitting ? "Placing order..." : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bakong KHQR Modal */}
      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-[#4f2206]">Pay with Bakong</div>
                <div className="text-xs text-gray-600">
                  {createdOrder?.reference ? `Order: ${createdOrder.reference}` : ""}
                </div>

                {khqr?.expires_at ? (
                  <div className="mt-1 text-xs text-gray-500">
                    Expires: {new Date(khqr.expires_at).toLocaleTimeString()}
                    {left !== null ? (
                      <span className="ml-2 font-semibold text-gray-700">({left}s)</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <button
                className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-[#4f2206] hover:bg-black/5"
                onClick={closePayModal}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 p-4">
              {payLoading ? (
                <div className="text-sm text-gray-700">Generating QR...</div>
              ) : payError ? (
                <div className="text-sm text-red-600">{payError}</div>
              ) : khqr?.qr_string ? (
                <KhqrCard
                  merchantName="Khmer cafe"
                  amountUsd={Number(createdOrder?.total ?? subtotal)}
                  qrString={khqr.qr_string}
                />
              ) : (
                <div className="text-sm text-gray-700">No QR available.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Page */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="rounded-3xl bg-[#064e4d] p-6 shadow-sm border border-black/5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-white">Search</div>
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

            <div className="hidden md:flex items-end justify-end">
              <div className="rounded-2xl bg-white/20 px-4 py-3">
                <div className="text-xs text-white/80">Cart total</div>
                <div className="text-lg font-extrabold text-white">${subtotal.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="mt-6 rounded-3xl">
          <div className="mb-3 flex items-center justify-between rounded-xl bg-[#042f2e] p-2 w-full">
            <div className="font-bold text-white text-xl">Menu</div>
            <div className="text-sm text-gray-300">{filtered.length} items</div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-100">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-100">
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
      </div>
    </div>
  );
}

function QtyBtn({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="h-9 w-9 rounded-xl border border-black/10 bg-white font-extrabold text-[#4f2206] hover:bg-black/5"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function 
MenuCard({
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
        type="button"
        className="mt-3 w-full rounded-2xl bg-[#042f2e] px-4 py-3 text-sm font-extrabold text-white hover:opacity-95"
        onClick={() => onAdd(product, size, sugar)}
      >
        + Add
      </button>
    </div>
  );
}