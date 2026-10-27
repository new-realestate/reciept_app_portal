import { apiRequest } from "../lib/apiClient";
import type {
  Customer,
  CustomerCreatePayload,
  CustomerDocuments,
  CustomerMatches,
  CustomerUpdatePayload,
} from "../lib/types";

export interface CustomerFilters {
  q?: string;
  status?: "active" | "archived";
  /** true: only customers with a tenant profile; false: only those without. */
  is_renter?: boolean;
}

export const customersApi = {
  list: (q?: string) => apiRequest<Customer[]>("/customers", { query: { q } }),

  listPage: async (q: string | undefined, limit: number, offset: number, filters: Omit<CustomerFilters, "q"> = {}) => {
    let total = 0;
    const items = await apiRequest<Customer[]>("/customers", {
      query: {
        q,
        limit,
        offset,
        status: filters.status,
        is_renter: filters.is_renter === undefined ? undefined : String(filters.is_renter),
      },
      onResponse: (r) => {
        total = Number(r.headers.get("X-Total-Count") ?? 0);
      },
    });
    return { items, total: total || items.length };
  },

  get: (id: string) => apiRequest<Customer>(`/customers/${id}`),

  /** Rejected with 409 (error.data.matches) when the email/phone already belongs to a customer, unless allow_duplicate. */
  create: (payload: CustomerCreatePayload) => apiRequest<Customer>("/customers", { method: "POST", body: payload }),

  update: (id: string, payload: CustomerUpdatePayload) =>
    apiRequest<Customer>(`/customers/${id}`, { method: "PATCH", body: payload }),

  archive: (id: string) => apiRequest<Customer>(`/customers/${id}/archive`, { method: "POST" }),

  restore: (id: string) => apiRequest<Customer>(`/customers/${id}/restore`, { method: "POST" }),

  matches: (params: { email?: string; phone?: string; name?: string }) =>
    apiRequest<CustomerMatches>("/customers/matches", { query: params }),

  documents: (id: string) => apiRequest<CustomerDocuments>(`/customers/${id}/documents`),
};
