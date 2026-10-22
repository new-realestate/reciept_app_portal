import { apiRequest } from "../lib/apiClient";
import type { Page } from "../lib/documentTypes";
import type { UserRole } from "../lib/types";

// Mirrors app/schemas/admin.py (platform super admin API).

export interface PlatformStats {
  businesses_total: number;
  businesses_active: number;
  businesses_suspended: number;
  users_total: number;
  users_suspended: number;
  signups_last_30_days: number;
  receipts_total: number;
  invoices_total: number;
  receipt_totals: { currency: string; amount_cents: number; count: number }[];
}

export interface AdminBusiness {
  id: string;
  business_name: string;
  plan_tier: string;
  default_currency: string;
  owner_email: string | null;
  user_count: number;
  receipt_count: number;
  last_login_at: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  business_name: string | null;
  is_superadmin: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface AdminBusinessDetail extends AdminBusiness {
  contact_email: string | null;
  contact_phone: string | null;
  physical_address: string | null;
  timezone: string;
  invoice_count: number;
  customer_count: number;
  users: AdminUser[];
}

export interface PlatformAuditEntry {
  id: string;
  tenant_id: string | null;
  business_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ImpersonationResponse {
  access_token: string;
  expires_in: number;
  tenant_id: string;
  business_name: string;
}

type Query = Record<string, string | number | undefined>;

export const platformApi = {
  stats: () => apiRequest<PlatformStats>("/admin/stats"),

  businesses: (query: { q?: string; status?: "active" | "suspended"; limit: number; offset: number }) =>
    apiRequest<Page<AdminBusiness>>("/admin/tenants", { query: query as Query }),
  business: (id: string) => apiRequest<AdminBusinessDetail>(`/admin/tenants/${id}`),
  suspendBusiness: (id: string, reason?: string) =>
    apiRequest<void>(`/admin/tenants/${id}/suspend`, { method: "POST", body: { reason: reason || null } }),
  reactivateBusiness: (id: string) => apiRequest<void>(`/admin/tenants/${id}/reactivate`, { method: "POST" }),
  actAsBusiness: (id: string) => apiRequest<ImpersonationResponse>(`/admin/tenants/${id}/impersonate`, { method: "POST" }),

  users: (query: {
    q?: string;
    tenant_id?: string;
    role?: UserRole;
    status?: "active" | "suspended" | "unverified";
    limit: number;
    offset: number;
  }) => apiRequest<Page<AdminUser>>("/admin/users", { query: query as Query }),
  updateUser: (id: string, body: { role?: UserRole; is_verified?: boolean }) =>
    apiRequest<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body }),
  suspendUser: (id: string, reason?: string) =>
    apiRequest<void>(`/admin/users/${id}/suspend`, { method: "POST", body: { reason: reason || null } }),
  reactivateUser: (id: string) => apiRequest<void>(`/admin/users/${id}/reactivate`, { method: "POST" }),
  sendPasswordReset: (id: string) => apiRequest<void>(`/admin/users/${id}/password-reset`, { method: "POST" }),
  deleteUser: (id: string) => apiRequest<void>(`/admin/users/${id}`, { method: "DELETE" }),

  auditLogs: (query: { tenant_id?: string; platform_only?: "true"; limit: number; offset: number }) =>
    apiRequest<Page<PlatformAuditEntry>>("/admin/audit-logs", { query: query as Query }),
};
