import type { Me, Permission, UserRole } from "../lib/types";

/**
 * Client-side permission gates for UI purposes only — the API is the source of
 * truth and enforces its own authorization. These mirror the role rules in the
 * product spec: Owner and Admin manage the business letterhead/bank details and
 * branding; Staff can issue and send receipts and manage their own signature,
 * but cannot touch tenant-wide settings.
 */
export const permissions = {
  canEditLetterhead: (role: UserRole) => role === "owner" || role === "admin",
  canUploadLogo: (role: UserRole) => role === "owner" || role === "admin",
  canEditBankDetails: (role: UserRole) => role === "owner" || role === "admin",
  canUploadSignature: (_role: UserRole) => true,
  canCreateReceipt: (_role: UserRole) => true,
  canSendReceipt: (_role: UserRole) => true,
  canViewAdminPortal: (role: UserRole) => role === "owner" || role === "admin",
  // Invoices, quotations and schedules: everyone can create, send and record payments;
  // cancelling, link revocation and business-wide reminder settings are Owner/Admin only.
  canManageDocuments: (role: UserRole) => role === "owner" || role === "admin",
};

/** Owners and admins hold every permission; staff hold the flags the owner/admin gave them. */
export function hasPermission(me: Pick<Me, "is_manager" | "permissions"> | null | undefined, perm: Permission): boolean {
  if (!me) return false;
  return me.is_manager || me.permissions.includes(perm);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full control of the business, including admins.",
  admin: "Manages the business: properties, staff, tenants, documents and settings.",
  staff: "Works on the properties assigned to them, within the permissions the owner set. Business settings are read-only.",
};
