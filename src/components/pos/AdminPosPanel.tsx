"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Minus, Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/app/lib/api";
import { OrdersApi } from "@/app/lib/orders";
import type { Product } from "@/app/types/entities";
import { KhqrCard } from "@/components/KhqrCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PaymentMethod = "cash" | "bakong";

type CartLine = {
  key: string;
  product_id?: number;
  name: string;
  size: string;
  sugar: string;
  qty: number;
  price: number;
  image?: string | null;
};

type KhqrResp = {
  order_id: number;
  reference: string;
  amount: number;
  currency: string;
  payment_id?: number;
  expires_at?: string;
  qr_string?: string;
  md5?: string;
};

type PayStatusResp = {
  paid: boolean;
  payment_status?: string;
  paid_at?: string | null;
  status?: string;
  bakong?: {
    data?: {
      externalRef?: string;
    };
  };
};

type ReceiptData = {
  reference: string;
  orderId: number;
  createdAt: string;
  currency: string;
  paymentMethod: PaymentMethod;
  items: CartLine[];
  total: number;
  paidAt?: string | null;
  cashReceived?: number;
  changeAmount?: number;
  bakongTrxId?: string;
};

const IMAGE_BASE =
  process.env.NEXT_PUBLIC_IMAGE_BASE_URL ??
  process.env.NEXT_PUBLIC_IMAGEPATH ??
  "http://127.0.0.1:8000/storage";

function imageUrl(image?: string | null) {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;

  const base = IMAGE_BASE.replace(/\/$/, "");
  const origin = base.replace(/\/storage$/, "");
  const normalized = image.replace(/^\/+/, "");

  if (normalized.startsWith("storage/") && base.endsWith("/storage")) {
    return `${origin}/${normalized}`;
  }

  return `${base}/${normalized}`;
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function printReceipt(receipt: ReceiptData) {
  const rows = receipt.items
    .map((item) => {
      const lineTotal = item.qty * item.price;
      return `<tr>
<td>${esc(item.name)} (${esc(item.size)}) x${item.qty}</td>
<td style="text-align:right;">${lineTotal.toFixed(2)}</td>
</tr>`;
    })
    .join("\n");

  const paidAt = receipt.paidAt ? new Date(receipt.paidAt) : new Date(receipt.createdAt);
  const paymentLabel = receipt.paymentMethod === "cash" ? "Cash" : "Bakong";

  const cashRows =
    receipt.paymentMethod === "cash"
      ? `<tr><td>Cash Received</td><td style="text-align:right;">${(receipt.cashReceived ?? 0).toFixed(2)}</td></tr>
<tr><td>Change</td><td style="text-align:right;">${(receipt.changeAmount ?? 0).toFixed(2)}</td></tr>`
      : "";

  const bakongRefRow =
    receipt.paymentMethod === "bakong" && receipt.bakongTrxId
      ? `<tr><td>Bakong Ref</td><td style="text-align:right;">${esc(receipt.bakongTrxId)}</td></tr>`
      : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(receipt.reference)}</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color:#111; margin:0; }
  .ticket { width: 320px; margin: 0 auto; padding: 16px; }
  .head { text-align:center; margin-bottom: 10px; }
  .store { font-size: 18px; font-weight: 700; }
  .sub { font-size: 12px; color:#4b5563; }
  table { width:100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 4px 0; vertical-align: top; }
  .sep { border-top: 1px dashed #9ca3af; margin: 8px 0; }
  .total td { font-size: 14px; font-weight: 700; }
  .foot { text-align:center; margin-top: 12px; font-size: 12px; color:#4b5563; }
</style>
</head>
<body>
  <div class="ticket">
    <div class="head">
      <div class="store">STARCOFFEE</div>
      <div class="sub">POS Receipt</div>
      <div class="sub">${esc(receipt.reference)} | #${receipt.orderId}</div>
      <div class="sub">${paidAt.toLocaleString()}</div>
    </div>

    <div class="sep"></div>

    <table>
      ${rows}
    </table>

    <div class="sep"></div>

    <table>
      <tr class="total"><td>Total</td><td style="text-align:right;">${receipt.total.toFixed(2)} ${esc(receipt.currency)}</td></tr>
      <tr><td>Payment</td><td style="text-align:right;">${paymentLabel}</td></tr>
      ${cashRows}
      ${bakongRefRow}
    </table>

    <div class="sep"></div>
    <div class="foot">Thank you for your order</div>
  </div>
</body>
</html>`;

  const popup = window.open("", "_blank", "width=420,height=760");
  if (!popup) {
    toast.error("Popup blocked. Allow popups to print receipt.");
    return;
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();

  popup.onload = () => {
    popup.focus();
    popup.print();
  };
}

export default function AdminPosPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdReference, setCreatedReference] = useState<string>("");
  const [khqr, setKhqr] = useState<KhqrResp | null>(null);
  const [checkingPay, setCheckingPay] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingProducts(true);
      try {
        const data = await apiGet<any>("/products?is_active=true");
        const rows = (data?.data ?? data) as Product[];
        setProducts((rows ?? []).filter((row: any) => row?.is_active !== false));
      } catch (e: any) {
        toast.error(e?.message || "Failed to load products");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!createdOrderId || !khqr) return;

    const timer = window.setInterval(() => {
      checkBakongPayment(createdOrderId, { silent: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [createdOrderId, khqr]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const byName = p.name.toLowerCase().includes(q);
      const bySlug = p.slug.toLowerCase().includes(q);
      const byCategory = p.category?.name?.toLowerCase().includes(q);
      const byType = p.product_type?.name?.toLowerCase().includes(q);
      return byName || bySlug || byCategory || byType;
    });
  }, [products, search]);

  const productImageById = useMemo(() => {
    const map = new Map<number, string | null | undefined>();
    products.forEach((p) => map.set(p.id, p.image));
    return map;
  }, [products]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, line) => sum + line.qty * line.price, 0);
  }, [cart]);

  const cashReceivedNum = Number(cashReceived || 0);
  const cashChange = Math.max(cashReceivedNum - subtotal, 0);

  function addLine(product: Product, size: string, price: number) {
    const key = `${product.id}:${size}`;

    setCart((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) => (line.key === key ? { ...line, qty: line.qty + 1 } : line));
      }

      return [
        ...prev,
        {
          key,
          product_id: product.id,
          name: product.name,
          size,
          sugar: "Normal",
          qty: 1,
          price,
          image: product.image ?? null,
        },
      ];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) => {
      const next = prev
        .map((line) => (line.key === key ? { ...line, qty: line.qty + delta } : line))
        .filter((line) => line.qty > 0);
      return next;
    });
  }

  function clearAfterPayment() {
    setCart([]);
    setCashReceived("");
    setCreatedOrderId(null);
    setCreatedReference("");
    setKhqr(null);
  }

  function buildReceiptData(params: {
    orderId: number;
    reference: string;
    paymentMethod: PaymentMethod;
    paidAt?: string | null;
    bakongTrxId?: string;
    cashReceivedAmount?: number;
  }): ReceiptData {
    const cashAmount = params.cashReceivedAmount ?? cashReceivedNum;
    return {
      orderId: params.orderId,
      reference: params.reference,
      createdAt: new Date().toISOString(),
      currency: "USD",
      paymentMethod: params.paymentMethod,
      items: cart,
      total: subtotal,
      paidAt: params.paidAt,
      cashReceived: params.paymentMethod === "cash" ? cashAmount : undefined,
      changeAmount: params.paymentMethod === "cash" ? Math.max(cashAmount - subtotal, 0) : undefined,
      bakongTrxId: params.bakongTrxId,
    };
  }

  async function checkBakongPayment(orderId: number, opts?: { silent?: boolean }) {
    if (checkingPay) return;

    setCheckingPay(true);
    try {
      const status = await apiGet<PayStatusResp>(`/orders/${orderId}/bakong/status`);
      if (status.paid || status.payment_status === "paid") {
        const nextReceipt = buildReceiptData({
          orderId,
          reference: createdReference,
          paymentMethod: "bakong",
          paidAt: status.paid_at,
          bakongTrxId: status?.bakong?.data?.externalRef,
        });

        setReceipt(nextReceipt);
        toast.success("Bakong payment confirmed");
        clearAfterPayment();
      }
    } catch (e: any) {
      if (!opts?.silent) {
        toast.error(e?.message || "Failed to check Bakong payment");
      }
    } finally {
      setCheckingPay(false);
    }
  }

  async function checkout() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const effectiveCashReceived = cashReceived.trim() === "" ? subtotal : cashReceivedNum;

    if (paymentMethod === "cash" && effectiveCashReceived < subtotal) {
      toast.error("Cash received must be at least order total");
      return;
    }

    setSubmitting(true);
    try {
      const created = await OrdersApi.create({
        items: cart.map((line) => ({
          product_id: line.product_id,
          name: line.name,
          size: line.size,
          sugar: line.sugar,
          qty: line.qty,
          price: line.price,
          image: line.image,
        })),
        payment_method: paymentMethod,
        currency: "USD",
      });

      if (paymentMethod === "cash") {
        const nextReceipt = buildReceiptData({
          orderId: created.id,
          reference: created.reference,
          paymentMethod: "cash",
          paidAt: created.paid_at,
          cashReceivedAmount: effectiveCashReceived,
        });

        setReceipt(nextReceipt);
        toast.success("Cash order paid");
        clearAfterPayment();
        return;
      }

      const khqrResp = await apiPost<KhqrResp>(`/orders/${created.id}/bakong/khqr`, {});
      if (!khqrResp?.qr_string) {
        throw new Error("Backend did not return qr_string");
      }

      setCreatedOrderId(created.id);
      setCreatedReference(created.reference);
      setKhqr(khqrResp);
      toast.success("Bakong QR generated");
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#173b31]">POS</h1>
        <p className="mt-1 text-sm text-[#5f7a70]">Create admin walk-in orders with cash or Bakong and print receipts.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="border-[#d8e6df] bg-white">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-[#1f3d34]">Products</CardTitle>
              <div className="flex w-full items-center gap-2 rounded-xl border border-[#d7e5de] bg-white px-3 py-2 sm:w-80">
                <Search className="h-4 w-4 text-[#6d8a80]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="text-sm text-[#6b857b]">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8e6df] p-10 text-center text-sm text-[#6b857b]">
                No products found.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-[#e5efea] p-3">
                    <div className="mb-2 h-28 overflow-hidden rounded-xl bg-[#f5f8f6]">
                      {product.image ? (
                        <img
                          src={imageUrl(product.image)}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#7b938a]">No image</div>
                      )}
                    </div>

                    <div className="font-semibold text-[#1f3d34]">{product.name}</div>
                    <div className="text-xs text-[#6e877e]">
                      {product.category?.name || "Category"} • {product.product_type?.name || "Type"}
                    </div>

                    <div className="mt-3 space-y-2">
                      {(product.variants ?? []).map((variant, idx) => (
                        <button
                          key={`${product.id}-${variant.size}-${idx}`}
                          onClick={() => addLine(product, variant.size, Number(variant.price || 0))}
                          className="flex w-full items-center justify-between rounded-lg border border-[#d7e5de] px-3 py-2 text-sm text-[#24443a] hover:bg-[#f4faf7]"
                        >
                          <span>{variant.size}</span>
                          <span className="font-semibold">{fmtMoney(Number(variant.price || 0))}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-[#d8e6df] bg-white">
            <CardHeader>
              <CardTitle className="text-[#1f3d34]">Cart</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d8e6df] p-6 text-center text-sm text-[#6b857b]">No items yet.</div>
              ) : (
                <>
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {cart.map((line) => (
                      <div key={line.key} className="rounded-xl border border-[#e5efea] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-lg bg-[#f5f8f6]">
                              {(line.image || (line.product_id ? productImageById.get(line.product_id) : null)) ? (
                                <img
                                  src={imageUrl(line.image || (line.product_id ? productImageById.get(line.product_id) : null))}
                                  alt={line.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-[#7b938a]">No image</div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[#1f3d34]">{line.name}</div>
                              <div className="text-xs text-[#6f897f]">{line.size}</div>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-[#1f3d34]">{fmtMoney(line.qty * line.price)}</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => changeQty(line.key, -1)}
                            className="rounded-lg border border-[#d7e5de] p-1 text-[#35584d]"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center text-sm text-[#35584d]">{line.qty}</span>
                          <button
                            onClick={() => changeQty(line.key, 1)}
                            className="rounded-lg border border-[#d7e5de] p-1 text-[#35584d]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#e5efea] pt-2 text-sm font-semibold text-[#1f3d34]">
                    <span>Total</span>
                    <span>{fmtMoney(subtotal)}</span>
                  </div>
                </>
              )}

              <div className="space-y-2 rounded-xl border border-[#d7e5de] p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5a756c]">Payment</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      paymentMethod === "cash"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-[#d7e5de] text-[#4f6d63]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" /> Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bakong")}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      paymentMethod === "bakong"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-[#d7e5de] text-[#4f6d63]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1"><CreditCard className="h-4 w-4" /> Bakong</span>
                  </button>
                </div>

                {paymentMethod === "cash" ? (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Cash received"
                    />
                    <div className="text-xs text-[#6f897f]">Change: {fmtMoney(cashChange)}</div>
                  </div>
                ) : (
                  <div className="text-xs text-[#6f897f]">After creating order, customer scans Bakong KHQR to pay.</div>
                )}
              </div>

              <Button onClick={checkout} disabled={submitting || cart.length === 0} className="w-full">
                {submitting ? "Processing..." : paymentMethod === "cash" ? "Pay Cash & Create Order" : "Create Order & Generate KHQR"}
              </Button>
            </CardContent>
          </Card>

          {khqr && createdOrderId ? (
            <Card className="border-[#d8e6df] bg-white">
              <CardHeader>
                <CardTitle className="text-[#1f3d34]">Bakong Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-[#6f897f]">Order {createdReference} • #{createdOrderId}</div>
                {khqr.qr_string ? (
                  <KhqrCard merchantName="STARCOFFEE" amountUsd={Number(khqr.amount || subtotal)} qrString={khqr.qr_string} />
                ) : null}
                <div className="flex gap-2">
                  <Button onClick={() => checkBakongPayment(createdOrderId)} disabled={checkingPay}>
                    {checkingPay ? "Checking..." : "Check Payment"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setKhqr(null);
                      setCreatedOrderId(null);
                      setCreatedReference("");
                    }}
                  >
                    Close QR
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {receipt ? (
            <Card className="border-[#d8e6df] bg-white">
              <CardHeader>
                <CardTitle className="text-[#1f3d34]">Latest Receipt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#37584d]">
                <div className="flex items-center justify-between">
                  <span>Reference</span>
                  <span className="font-medium">{receipt.reference}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-medium">{fmtMoney(receipt.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment</span>
                  <span className="font-medium capitalize">{receipt.paymentMethod}</span>
                </div>
                <Button className="mt-2 w-full" variant="secondary" onClick={() => printReceipt(receipt)}>
                  Print Receipt
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
