const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function createKhqr(orderId: number) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/bakong/khqr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    order_id: number;
    reference: string;
    amount: number;
    currency: string;
    payment_id: number;
    expires_at: string;
    qr_string: string;
    md5: string;
    full_hash: string;
  }>;
}

export async function checkKhqrStatus(orderId: number) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/bakong/status`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ paid: boolean; order?: any; bakong?: any }>;
}
