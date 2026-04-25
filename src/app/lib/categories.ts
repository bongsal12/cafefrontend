import { apiDel, apiGet, apiPost } from "@/app/lib/api";
import type { Category } from "@/app/types/entities";

export const CategoriesApi = {
  list: () => apiGet<Category[]>("/categories"),
  create: (payload: { name: string; slug?: string }) => apiPost<Category>("/categories", payload),
  remove: (id: number) => apiDel<{ ok: boolean }>(`/categories/${id}`),
};