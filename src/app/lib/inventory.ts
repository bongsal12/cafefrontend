import { apiGet, apiPatch, apiPost, apiDel, apiUpload } from "@/app/lib/api";
import type { InventoryItem, InventoryMovement, Recipe, RecipeItem, StockCountSession } from "@/app/types/entities";

export const InventoryApi = {
  dashboard: async () => {
    const res = await apiGet<any>("/inventory/dashboard");
    return res;
  },

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
    payload: { name?: string; category?: string; slug?: string; unit?: string; low_stock_alert?: number; cost_per_unit?: number; sweetness_levels?: string[]; is_active?: boolean; imageFile?: File | null },
  ) => {
    const fd = new FormData();
    fd.append("_method", "PATCH");
    if (payload.name) fd.append("name", payload.name);
    if (payload.category) fd.append("category", payload.category);
    if (payload.slug !== undefined) fd.append("slug", payload.slug);
    if (payload.unit) fd.append("unit", payload.unit);
    if (typeof payload.low_stock_alert !== "undefined") fd.append("low_stock_alert", String(payload.low_stock_alert));
    if (typeof payload.cost_per_unit !== "undefined") fd.append("cost_per_unit", String(payload.cost_per_unit));
    if (payload.sweetness_levels !== undefined) {
      if (payload.sweetness_levels.length) payload.sweetness_levels.forEach((level) => fd.append("sweetness_levels[]", level));
      else fd.append("sweetness_levels[]", "");
    }
    if (typeof payload.is_active !== "undefined") fd.append("is_active", payload.is_active ? "1" : "0");
    if (payload.imageFile) fd.append("image", payload.imageFile);

    return apiUpload<InventoryItem>(`/inventory/items/${id}`, fd, { method: "POST" });
  },

  create: (payload: { name: string; category?: string; slug?: string; imageFile?: File | null; current_stock?: number; unit?: string; low_stock_alert?: number; cost_per_unit?: number; sweetness_levels?: string[]; is_active?: boolean }) => {
    const fd = new FormData();
    fd.append("name", payload.name);
    if (payload.category) fd.append("category", payload.category);
    if (payload.slug) fd.append("slug", payload.slug);
    if (typeof payload.current_stock !== "undefined") fd.append("current_stock", String(payload.current_stock));
    if (payload.unit) fd.append("unit", payload.unit);
    if (typeof payload.low_stock_alert !== "undefined") fd.append("low_stock_alert", String(payload.low_stock_alert));
    if (typeof payload.cost_per_unit !== "undefined") fd.append("cost_per_unit", String(payload.cost_per_unit));
    if (payload.sweetness_levels !== undefined) {
      if (payload.sweetness_levels.length) payload.sweetness_levels.forEach((level) => fd.append("sweetness_levels[]", level));
      else fd.append("sweetness_levels[]", "");
    }
    if (typeof payload.is_active !== "undefined") fd.append("is_active", payload.is_active ? "1" : "0");
    if (payload.imageFile) fd.append("image", payload.imageFile);

    return apiUpload<InventoryItem>(`/inventory/items`, fd);
  },

  remove: (id: number) => apiDel(`/inventory/items/${id}`),

  moveStock: (payload: {
    inventory_item_id: number;
    type: "in" | "out" | "adjustment" | "purchase" | "waste" | "sale_usage" | "stock_count";
    quantity: number;
    note?: string;
  }) => apiPost<{ item: InventoryItem; movement: InventoryMovement }>("/inventory/movements", payload),

  stockIn: (payload: {
    supplier: string;
    invoice_no: string;
    purchase_date: string;
    note?: string;
    items: Array<{ inventory_item_id: number; quantity: number; unit_cost: number }>;
  }) => apiPost(`/inventory/stock-in`, payload),

  stockInRecords: async (params?: { from?: string; to?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiGet<{ data: InventoryMovement[] }>(`/inventory/stock-in-records${suffix}`);
    return res.data ?? [];
  },

  waste: (payload: {
    inventory_item_id: number;
    quantity: number;
    reason: string;
    date?: string;
    note?: string;
  }) => apiPost(`/inventory/waste`, payload),

  wasteRecords: async (params?: { from?: string; to?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiGet<{ data: InventoryMovement[] }>(`/inventory/waste-records${suffix}`);
    return res.data ?? [];
  },

  movementRecords: async (params?: { from?: string; to?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.limit) query.set("limit", String(params.limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiGet<{ data: InventoryMovement[] }>(`/inventory/movement-records${suffix}`);
    return res.data ?? [];
  },

  recipes: async (search?: string) => {
    const suffix = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await apiGet<{ data: Recipe[] }>(`/inventory/recipes${suffix}`);
    return res.data ?? [];
  },

  recipe: (id: number) => apiGet<{ recipe: Recipe; availability: any }>(`/inventory/recipes/${id}`),

  saveRecipe: (payload: {
    product_id: number;
    size: string;
    description?: string;
    selling_price: number;
    is_active?: boolean;
    items: Array<{ inventory_item_id: number; quantity_used: number; unit: string }>;
    sweetness_options?: Array<{ level: string; inventory_item_id: number | null; quantity: number }>;
  }) => apiPost<Recipe>("/inventory/recipes", payload),

  updateRecipe: (id: number, payload: Partial<{
    size: string;
    description: string;
    selling_price: number;
    is_active: boolean;
    items: Array<{ inventory_item_id: number; quantity_used: number; unit: string }>;
    sweetness_options?: Array<{ level: string; inventory_item_id: number | null; quantity: number }>;
  }>) => apiPatch<Recipe>(`/inventory/recipes/${id}`, payload),

  deleteRecipe: (id: number) => apiDel(`/inventory/recipes/${id}`),

  stockCount: (payload: {
    count_date: string;
    branch?: string;
    note?: string;
    status?: string;
    apply?: boolean;
    items: Array<{ inventory_item_id: number; actual_count: number; reason?: string }>;
  }) => apiPost<StockCountSession>(`/inventory/stock-counts`, payload),

  availability: (payload: { product_id: number; size?: string }) => {
    const params = new URLSearchParams();
    params.set("product_id", String(payload.product_id));
    if (payload.size) params.set("size", payload.size);
    return apiGet<any>(`/inventory/availability?${params.toString()}`);
  },

  movements: async (productId: number, limit = 30) => {
    const res = await apiGet<{ data: InventoryMovement[] }>(`/inventory/items/${productId}/movements?limit=${limit}`);
    return res.data ?? [];
  },
};
