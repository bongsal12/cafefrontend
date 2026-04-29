import { apiGet, apiPatch, apiPost } from "@/app/lib/api";

export type OrderItem = { name: string; size: string; qty: number; price: number; sugar: string; image?: string | null };
export type Order = {
  id: number;
  reference: string;
  status: string; // paid/completed/cancelled...
  total: number | string;
  items: OrderItem[];
  created_at: string;
  currency?: string;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  paid_at?: string | null;
};

export const OrdersApi = {
  list: () => apiGet<Order[]>("/orders"),
  create: (payload: {
    items: Array<{ product_id?: number; name: string; size: string; sugar: string; qty: number; price: number; image?: string | null }>;
    payment_method?: "cash" | "bakong";
    status?: string;
    currency?: string;
  }) => apiPost<Order>("/orders", payload),
  updateStatus: (orderId: number, status: "completed" | "cancelled") =>
    apiPatch<Order>(`/orders/${orderId}/status`, { status }),
};