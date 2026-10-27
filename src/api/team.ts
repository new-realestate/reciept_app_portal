import { apiRequest } from "../lib/apiClient";
import type {
  Assignment,
  PermissionCatalog,
  TeamMember,
  TeamMemberCreatePayload,
  TeamMemberUpdatePayload,
} from "../lib/propertyTypes";

/** Owner/admin only: the business's team members. */
export const teamApi = {
  permissions: () => apiRequest<PermissionCatalog>("/team/permissions"),

  list: () => apiRequest<TeamMember[]>("/team/members"),

  get: (id: string) => apiRequest<TeamMember>(`/team/members/${id}`),

  /** Creates the account and emails the member a link to choose their password. */
  create: (payload: TeamMemberCreatePayload) => apiRequest<TeamMember>("/team/members", { method: "POST", body: payload }),

  update: (id: string, payload: TeamMemberUpdatePayload) =>
    apiRequest<TeamMember>(`/team/members/${id}`, { method: "PATCH", body: payload }),

  deactivate: (id: string, reason?: string) =>
    apiRequest<TeamMember>(`/team/members/${id}/deactivate`, { method: "POST", body: { reason: reason || undefined } }),

  reactivate: (id: string) => apiRequest<TeamMember>(`/team/members/${id}/reactivate`, { method: "POST" }),

  resendInvite: (id: string) => apiRequest<void>(`/team/members/${id}/resend-invite`, { method: "POST" }),

  assignments: (id: string) => apiRequest<Assignment[]>(`/team/members/${id}/assignments`),
};
