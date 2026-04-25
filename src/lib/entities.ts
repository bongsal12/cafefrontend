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

export type ProductVariant = {
  size: string;
  price: number | string;
};

export type Product = {
  id: number;
  category_id: number;
  product_type_id: number;
  name: string;
  slug: string;
  image?: string | null;
  variants: ProductVariant[];

  // optional expanded fields if your API returns them
  category?: Category | null;
  product_type?: ProductType | null;
};