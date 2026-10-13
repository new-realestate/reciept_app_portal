import { apiRequest } from "../lib/apiClient";
import type { Page } from "../lib/documentTypes";

export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditFilters {
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  list: (filters: AuditFilters) =>
    apiRequest<Page<AuditEntry>>("/audit-logs", { query: filters as Record<string, string | number | undefined> }),
  actions: () => apiRequest<string[]>("/audit-logs/actions"),
};
