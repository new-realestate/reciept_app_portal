import { apiRequest } from "../lib/apiClient";
import type { Assignment, Property, PropertyDetail, PropertyPayload, Unit, UnitPayload } from "../lib/propertyTypes";

export interface PropertyFilters {
  q?: string;
  status?: string;
  assigned_to?: string;
}

export const propertiesApi = {
  /** Owners/admins get the whole portfolio; staff only the properties assigned to them. */
  list: (filters: PropertyFilters = {}) => apiRequest<Property[]>("/properties", { query: { ...filters, limit: 200 } }),

  get: (id: string) => apiRequest<PropertyDetail>(`/properties/${id}`),

  create: (payload: PropertyPayload & { name: string }) =>
    apiRequest<PropertyDetail>("/properties", { method: "POST", body: payload }),

  update: (id: string, payload: PropertyPayload) =>
    apiRequest<PropertyDetail>(`/properties/${id}`, { method: "PATCH", body: payload }),

  archive: (id: string) => apiRequest<PropertyDetail>(`/properties/${id}/archive`, { method: "POST" }),

  createUnit: (propertyId: string, payload: UnitPayload & { label: string }) =>
    apiRequest<Unit>(`/properties/${propertyId}/units`, { method: "POST", body: payload }),

  updateUnit: (propertyId: string, unitId: string, payload: UnitPayload) =>
    apiRequest<Unit>(`/properties/${propertyId}/units/${unitId}`, { method: "PATCH", body: payload }),

  assignments: (propertyId: string) => apiRequest<Assignment[]>(`/properties/${propertyId}/assignments`),

  assign: (propertyId: string, userId: string) =>
    apiRequest<PropertyDetail>(`/properties/${propertyId}/assignments`, { method: "POST", body: { user_id: userId } }),

  revoke: (propertyId: string, userId: string) =>
    apiRequest<PropertyDetail>(`/properties/${propertyId}/assignments/${userId}`, { method: "DELETE" }),
};
