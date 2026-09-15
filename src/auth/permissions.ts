import type { UserRole } from "../lib/types";

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
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full access to receipts, customers, branding, and bank details.",
  admin: "Full access to receipts, customers, branding, and bank details.",
  staff: "Can issue, view, and send receipts. Business settings are read-only.",
};
