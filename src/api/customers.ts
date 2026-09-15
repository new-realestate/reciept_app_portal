import { apiRequest } from "../lib/apiClient";
import type { Customer, CustomerCreatePayload } from "../lib/types";

export const customersApi = {
  list: (q?: string) => apiRequest<Customer[]>("/customers", { query: { q } }),

  create: (payload: CustomerCreatePayload) => apiRequest<Customer>("/customers", { method: "POST", body: payload }),
};
