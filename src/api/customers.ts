import { apiRequest } from "../lib/apiClient";
import type { Customer, CustomerCreatePayload } from "../lib/types";

export const customersApi = {
  list: (q?: string) => apiRequest<Customer[]>("/customers", { query: { q } }),

  listPage: async (q: string | undefined, limit: number, offset: number) => {
    let total = 0;
    const items = await apiRequest<Customer[]>("/customers", {
      query: { q, limit, offset },
      onResponse: (r) => {
        total = Number(r.headers.get("X-Total-Count") ?? 0);
      },
    });
    return { items, total: total || items.length };
  },

  create: (payload: CustomerCreatePayload) => apiRequest<Customer>("/customers", { method: "POST", body: payload }),
};
