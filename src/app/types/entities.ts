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
  is_sold_out?: boolean;
  inventory_availability?: {
    available: number;
    reasons: string[];
    size?: string;
  } | null;
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
  category: string;
  slug: string;
  image?: string | null;
  current_stock: number;
  unit: string;
  low_stock_alert: number;
  cost_per_unit: number;
  sweetness_levels?: string[];
  is_low_stock: boolean;
  is_active: boolean;
  updated_at?: string;
};

export type InventoryMovement = {
  id: number;
  inventory_item_id?: number;
  ingredient_name?: string | null;
  type: "in" | "out" | "adjustment" | "purchase" | "waste" | "sale_usage" | "stock_count";
  quantity: number;
  unit: string;
  before_stock: number;
  after_stock: number;
  note?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  created_at?: string;
};

export type RecipeItem = {
  id?: number;
  inventory_item_id: number;
  ingredient: string;
  quantity_used: number;
  unit: string;
  cost_per_unit: number;
  cost_per_drink: number;
};

export type Recipe = {
  id: number;
  product_id: number;
  product_name: string;
  category?: string | null;
  size: string;
  description?: string | null;
  selling_price: number;
  total_cost: number;
  profit: number;
  margin: number;
  status: string;
  items: RecipeItem[];
};

export type StockCountSession = {
  id: number;
  count_date: string;
  branch?: string | null;
  counted_by?: number | null;
  note?: string | null;
  status: string;
  approved_by?: number | null;
  items?: StockCountItem[];
};

export type StockCountItem = {
  id: number;
  stock_count_session_id: number;
  inventory_item_id: number;
  system_stock: number;
  actual_count: number;
  difference: number;
  reason?: string | null;
  status: string;
  movement_id?: number | null;
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

