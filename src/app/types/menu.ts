export type HotItem = { price: number; size: string };
export type IcedItem = { sizes: Record<string, { price: number }> };
export type MenuItem = HotItem | IcedItem;

export type MenuResponse = {
  menu: Record<
    string, // category slug
    Record<
      string, // type slug
      Record<string, MenuItem> // product slug
    >
  >;
  currency: string;
  lastUpdated: string;
};

export const isIcedItem = (item: MenuItem): item is IcedItem =>
  (item as IcedItem).sizes !== undefined;
