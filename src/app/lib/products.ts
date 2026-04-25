import { apiDel, apiGet, apiUpload } from "@/app/lib/api";
import type { Product } from "@/app/types/entities";

export type ProductUpsert = {
  category_id: number;
  product_type_id: number;
  name: string;
  slug: string;
  variants: { size: string; price: number }[];
  imageFile?: File | null;
};

function buildForm(payload: ProductUpsert, opts?: { methodOverride?: "PUT" | "PATCH" }) {
  const fd = new FormData();
  fd.append("category_id", String(payload.category_id));
  fd.append("product_type_id", String(payload.product_type_id));
  fd.append("name", payload.name);
  fd.append("slug", payload.slug);
  fd.append("variants", JSON.stringify(payload.variants));

  if (payload.imageFile) fd.append("image", payload.imageFile);

  // Laravel update via POST + _method
  if (opts?.methodOverride) fd.append("_method", opts.methodOverride);

  return fd;
}

export const ProductsApi = {
  list: async () => {
    const res = await apiGet<any>("/products");
    return (res?.data ?? res) as Product[];
  },

  create: (payload: ProductUpsert) => {
    const fd = buildForm(payload);
    return apiUpload<Product>("/products", fd);
  },

  update: (id: number, payload: ProductUpsert) => {
    const fd = buildForm(payload, { methodOverride: "PUT" });
    return apiUpload<Product>(`/products/${id}`, fd);
  },

  remove: (id: number) => apiDel<{ ok: boolean }>(`/products/${id}`),
};