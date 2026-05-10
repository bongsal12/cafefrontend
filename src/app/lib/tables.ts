import { apiDel, apiGet, apiPatch, apiPost } from "@/app/lib/api";
import type { DiningTable } from "@/app/types/entities";

export type DiningTableUpsert = {
  name: string;
  slug?: string;
  is_active?: boolean;
};

export const TablesApi = {
  list: async () => apiGet<DiningTable[]>('/tables'),

  create: (payload: DiningTableUpsert) => apiPost<DiningTable>("/tables", payload),

  update: (id: number, payload: DiningTableUpsert) => apiPatch<DiningTable>(`/tables/${id}`, payload),

  remove: (id: number) => apiDel<{ message: string }>(`/tables/${id}`),
};
