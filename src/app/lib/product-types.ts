import { apiDel, apiGet, apiPost } from "@/app/lib/api";
import type { ProductType } from "@/app/types/entities";

export const ProductTypesApi = {
  list: () => apiGet<ProductType[]>("/product-types"),
  create: (payload: { name: string; slug?: string }) => apiPost<ProductType>("/product-types", payload),
  remove: (id: number) => apiDel<{ ok: boolean }>(`/product-types/${id}`),
};