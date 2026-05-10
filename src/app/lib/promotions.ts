import { apiGet, apiPost, apiPatch, apiDel } from "@/app/lib/api";

export type PromotionScope = "product" | "category";

export type PromotionUpsert = {
  name: string;
  scope_type: PromotionScope;
  product_id?: number;
  category_id?: number;
  percent: number;
  apply_to_variants?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  active?: boolean;
};

export type PromotionRecord = PromotionUpsert & {
  id: number;
  status: "active" | "scheduled" | "expired";
  scope_label?: string;
  product?: { id: number; name: string; image?: string | null } | null;
  category?: { id: number; name: string } | null;
  created_at?: string;
  updated_at?: string;
};

export const PromotionsApi = {
  list: () => apiGet<{ data: PromotionRecord[] }>("/promotions").then((r) => r.data ?? []),
  get: (id: number) => apiGet<PromotionRecord>(`/promotions/${id}`),
  create: (payload: PromotionUpsert) => apiPost<PromotionRecord>(`/promotions`, payload),
  update: (id: number, payload: Partial<PromotionUpsert>) => apiPatch<PromotionRecord>(`/promotions/${id}`, payload),
  remove: (id: number) => apiDel<{ message: string }>(`/promotions/${id}`),
};
