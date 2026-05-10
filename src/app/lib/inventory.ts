import { apiGet, apiPatch, apiPost, apiDel, apiUpload } from "@/app/lib/api";
import type { InventoryItem, InventoryMovement } from "@/app/types/entities";

export const InventoryApi = {
  list: async (params?: { search?: string; lowOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.lowOnly) query.set("low_only", "1");

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiGet<{ data: InventoryItem[] }>(`/inventory/items${suffix}`);
    return res.data ?? [];
  },

  updateSettings: (
    id: number,
    payload: { name?: string; slug?: string; unit?: string; low_stock_alert?: number; imageFile?: File | null },
  ) => {
    const fd = new FormData();
    if (payload.name) fd.append("name", payload.name);
    if (payload.slug !== undefined) fd.append("slug", payload.slug);
    if (payload.unit) fd.append("unit", payload.unit);
    if (typeof payload.low_stock_alert !== "undefined") fd.append("low_stock_alert", String(payload.low_stock_alert));
    if (payload.imageFile) fd.append("image", payload.imageFile);

    return apiUpload<InventoryItem>(`/inventory/items/${id}`, fd, { method: "PATCH" });
  },

  create: (payload: { name: string; slug?: string; imageFile?: File | null; current_stock?: number; unit?: string; low_stock_alert?: number }) => {
    const fd = new FormData();
    fd.append("name", payload.name);
    if (payload.slug) fd.append("slug", payload.slug);
    if (typeof payload.current_stock !== "undefined") fd.append("current_stock", String(payload.current_stock));
    if (payload.unit) fd.append("unit", payload.unit);
    if (typeof payload.low_stock_alert !== "undefined") fd.append("low_stock_alert", String(payload.low_stock_alert));
    if (payload.imageFile) fd.append("image", payload.imageFile);

    return apiUpload<InventoryItem>(`/inventory/items`, fd);
  },

  remove: (id: number) => apiDel(`/inventory/items/${id}`),

  moveStock: (payload: {
    inventory_item_id: number;
    type: "in" | "out" | "adjustment";
    quantity: number;
    note?: string;
  }) => apiPost<{ item: InventoryItem; movement: InventoryMovement }>("/inventory/movements", payload),

  movements: async (productId: number, limit = 30) => {
    const res = await apiGet<{ data: InventoryMovement[] }>(`/inventory/items/${productId}/movements?limit=${limit}`);
    return res.data ?? [];
  },
};
