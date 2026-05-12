import { apiGet } from "@/app/lib/api";

export type ProfitMetrics = {
  sales_income: number;
  ingredient_cost: number;
  gross_profit: number;
  waste_cost: number;
  final_profit: number;
  orders: number;
};

export type DailyProfit = {
  date: string;
  sales_income: number;
  ingredient_cost: number;
  gross_profit: number;
  waste_cost: number;
  final_profit: number;
};

export type ProfitReport = {
  range: {
    key: string;
    days: number;
    start: string;
    end: string;
    from: string | null;
    to: string | null;
  };
  currency: string;
  totals: ProfitMetrics;
  daily: DailyProfit[];
};

export const ReportsApi = {
  profit: async (params?: { range?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.range) query.set("range", params.range);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiGet<ProfitReport>(`/reports/profit${suffix}`);
    return res;
  },
};
