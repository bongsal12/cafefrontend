export type ProductVariant = {
  id?: number;
  size: string;
  price: number;
  original_price?: number;
  discounted_price?: number;
  has_discount?: boolean;
};

export type Product = {
  id: number;
  category_id: number;
  product_type_id: number;
  name: string;
  slug: string;
  image?: string | null;
  is_active?: boolean;
  current_stock?: number;
  unit?: string;
  low_stock_alert?: number;
  is_low_stock?: boolean;
  has_discount?: boolean;
  active_promotion?: {
    id: number;
    name: string;
    scope_type: "product" | "category";
    percent: number;
    start_at?: string | null;
    end_at?: string | null;
  } | null;
  variants: ProductVariant[];
    category?: Category | null;
  product_type?: ProductType | null;
};

export type InventoryItem = {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  current_stock: number;
  unit: string;
  low_stock_alert: number;
  is_low_stock: boolean;
  is_active: boolean;
  updated_at?: string;
};

export type InventoryMovement = {
  id: number;
  type: "in" | "out" | "adjustment";
  quantity: number;
  unit: string;
  before_stock: number;
  after_stock: number;
  note?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string;
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

export type DiningTable = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

