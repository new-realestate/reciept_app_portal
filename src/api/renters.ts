import { apiRequest } from "../lib/apiClient";
import type {
  Renter,
  RenterCreatePayload,
  RenterDetail,
  RenterUpdatePayload,
  Tenancy,
  TenancyPayload,
} from "../lib/propertyTypes";

export interface RenterFilters {
  q?: string;
  status?: string;
  property_id?: string;
}

/** Renters are shown as "Tenants" in the portal ("tenant" means the business in the API). */
export const rentersApi = {
  listPage: async (filters: RenterFilters, limit: number, offset: number) => {
    let total = 0;
    const items = await apiRequest<Renter[]>("/renters", {
      query: { ...filters, limit, offset },
      onResponse: (r) => {
        total = Number(r.headers.get("X-Total-Count") ?? 0);
      },
    });
    return { items, total: total || items.length };
  },

  get: (id: string) => apiRequest<RenterDetail>(`/renters/${id}`),

  /** Customer (new or existing), tenant profile and first tenancy, saved together. */
  create: (payload: RenterCreatePayload) => apiRequest<RenterDetail>("/renters", { method: "POST", body: payload }),

  update: (id: string, payload: RenterUpdatePayload) =>
    apiRequest<RenterDetail>(`/renters/${id}`, { method: "PATCH", body: payload }),

  addTenancy: (renterId: string, payload: TenancyPayload) =>
    apiRequest<Tenancy>(`/renters/${renterId}/tenancies`, { method: "POST", body: payload }),

  endTenancy: (tenancyId: string, payload: { end_date: string; status: "ended" | "terminated"; reason?: string }) =>
    apiRequest<Tenancy>(`/tenancies/${tenancyId}/end`, { method: "POST", body: payload }),
};
