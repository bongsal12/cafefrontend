export type ProductVariant = { id?: number; size: string; price: number };

export type Product = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  image?: string | null;
  variants: ProductVariant[];
};
