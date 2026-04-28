export type ProductVariant = { id?: number; size: string; price: number };

export type Product = {
  id: number;
  category_id: number;
  product_type_id: number;
  name: string;
  slug: string;
  image?: string | null;
  is_active?: boolean;
  variants: ProductVariant[];
    category?: Category | null;
  product_type?: ProductType | null;
};
export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type ProductType = {
  id: number;
  name: string;
  slug: string;
};

