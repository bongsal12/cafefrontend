import { apiGet, apiPatch } from "@/app/lib/api";

export type OrderItem = { name: string; size: string; qty: number; price: number; sugar: string };
export type Order = {
  id: number;
  reference: string;
  status: string; // paid/completed/cancelled...
  total: number | string;
  items: OrderItem[];
  created_at: string;
};

export const OrdersApi = {
  list: () => apiGet<Order[]>("/orders"),
  updateStatus: (orderId: number, status: "completed" | "cancelled") =>
    apiPatch<Order>(`/orders/${orderId}/status`, { status }),
};