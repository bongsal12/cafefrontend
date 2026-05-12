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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  original_price?: number;
  discounted_price?: number;
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

const SUGAR_OPTIONS = [
  { label: "No sweet", value: "No sweet" },
  { label: "Less", value: "Less" },
  { label: "Normal", value: "Normal" },
  { label: "More", value: "More" },
];

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
      const original = (item as any).original_price ?? item.price;
      const discounted = (item as any).discounted_price ?? item.price;
      const hasDiscount = discounted < original;

      const priceHtml = hasDiscount
        ? `<div style="font-size:12px;color:#6b7280;"><span style="text-decoration:line-through;margin-right:6px;">${original.toFixed(2)}</span><span style="font-weight:700;color:#a71237;">${discounted.toFixed(2)}</span></div>`
        : `<div style="font-size:12px;font-weight:700;">${discounted.toFixed(2)}</div>`;

      return `<tr>
    <td>
    <div>${esc(item.name)} (${esc(item.size)} • ${esc(item.sugar)}) x${item.qty}</div>
${priceHtml}
</td>
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
      <div class="sub"> Receipt</div>
      <div class="sub">Invoice:${esc(receipt.reference)} | #${receipt.orderId}</div>
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

function PosProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product, size: string, sugar: string, original: number, discounted: number) => void;
}) {
  const [size, setSize] = useState(product.variants?.[0]?.size || "regular");
  const [sugar, setSugar] = useState(SUGAR_OPTIONS[2]?.value ?? "Normal");

  const selectedVariant = product.variants.find((v) => v.size === size) ?? product.variants[0];
  const original = Number(selectedVariant?.original_price ?? selectedVariant?.price ?? 0);
  const discounted = Number(selectedVariant?.discounted_price ?? selectedVariant?.price ?? 0);
  const hasDiscount = discounted < original;

  // Check availability
  const unavailable = Number(product.inventory_availability?.available ?? 0) <= 0 || product.is_sold_out;
  let buttonText = "+ Add";
  let statusMessage = "";

  if (unavailable) {
    buttonText = "Not Available";
    statusMessage = "Temporarily unavailable";
    if (product.inventory_availability?.reasons?.length) {
      const reason = product.inventory_availability.reasons[0];
      const match = reason.match(/Not enough (\w+)/);
      if (match) {
        buttonText = "Sold Out";
        statusMessage = `Not enough ${match[1]}`;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-[#e5efea] p-3">
      <div className="mb-2 h-42 overflow-hidden rounded-xl bg-[#f5f8f6]">
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

      <div className="mt-3 grid gap-2">
        <div className="grid gap-1">
          <div className="text-xs font-medium text-[#35584d]">Size</div>
          <select
            className="rounded-lg border border-[#d7e5de] bg-white px-3 py-2 text-sm text-[#24443a]"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            disabled={unavailable}
          >
            {(product.variants ?? []).map((variant) => (
              <option key={variant.id ?? variant.size} value={variant.size}>
                {variant.size}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <div className="text-xs font-medium text-[#35584d]">Sugar</div>
          <select
            className="rounded-lg border border-[#d7e5de] bg-white px-3 py-2 text-sm text-[#24443a]"
            value={sugar}
            onChange={(e) => setSugar(e.target.value)}
            disabled={unavailable}
          >
            {SUGAR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-right">
          {hasDiscount ? (
            <>
              <div className="flex gap-1"><div className="text-xs text-gray-400 line-through">{fmtMoney(original)}</div>
                <div className="text-sm font-semibold text-[#a71237]">{fmtMoney(discounted)}</div></div>
            </>
          ) : (
            <div className="text-sm font-semibold text-[#a71237]">{fmtMoney(discounted)}</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAdd(product, size, sugar, original, discounted)}
          className={`rounded-xl px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed ${unavailable ? "bg-gray-400" : "bg-[#0b4b46]"
            }`}
          disabled={unavailable}
        >
          {buttonText}
        </button>
        {statusMessage && <div className="mt-2 text-xs text-red-600">{statusMessage}</div>}
      </div>
    </div>
  );
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

  function addLine(product: Product, size: string, sugar: string, original: number, discounted: number) {
    const key = `${product.id}:${size}:${sugar}`;

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
          sugar,
          qty: 1,
          price: discounted,
          original_price: original,
          discounted_price: discounted,
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
          original_price: line.original_price,
          discounted_price: line.discounted_price,
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
                  <PosProductCard key={product.id} product={product} onAdd={addLine} />
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
                              <div className="text-xs text-[#6f897f]">{line.size} • {line.sugar}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            {line.original_price && line.discounted_price && line.discounted_price < line.original_price ? (
                              <div>
                                <div className="text-xs text-gray-400 line-through">{fmtMoney(line.original_price)}</div>
                                <div className="text-sm font-semibold text-[#a71237]">{fmtMoney(line.discounted_price)}</div>
                                <div className="text-xs text-[#6b7280]">{fmtMoney(line.qty * (line.discounted_price ?? line.price))}</div>
                              </div>
                            ) : (
                              <div className="text-sm font-semibold text-[#a71237]">{fmtMoney(line.qty * line.price)}</div>
                            )}
                          </div>
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

                  <div className="flex items-center justify-between  border-t border-[#e5efea] pt-2 text-sm font-semibold text-[#1f3d34]">
                    <span>Total</span>
                    <span className="text-[#a71237]">{fmtMoney(subtotal)}</span>
                  </div>
                </>
              )}

              <div className="space-y-2 rounded-xl border border-[#d7e5de] p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5a756c]">Payment</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`rounded-lg border px-3 py-2 text-sm ${paymentMethod === "cash"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-[#d7e5de] text-[#4f6d63]"
                      }`}
                  >
                    <span className="inline-flex items-center gap-1"><Wallet className="h-4 w-4" />Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bakong")}
                    className={`rounded-lg border px-3 py-2 text-sm ${paymentMethod === "bakong"
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

          <Dialog
            open={Boolean(khqr && createdOrderId)}
            onOpenChange={(open) => {
              if (!open) {
                setKhqr(null);
                setCreatedOrderId(null);
                setCreatedReference("");
              }
            }}
          >
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader>
                <DialogTitle>Bakong Payment</DialogTitle>
              </DialogHeader>

              {khqr?.qr_string ? (
                <div className="flex justify-center">
                  <KhqrCard merchantName="STARCOFFEE" amountUsd={Number(khqr.amount || subtotal)} qrString={khqr.qr_string} />
                </div>
              ) : null}
              <div className="flex gap-2 mt-4">
                <Button onClick={() => createdOrderId && checkBakongPayment(createdOrderId)} disabled={checkingPay}>
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
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
