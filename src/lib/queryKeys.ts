/**
 * Cache keys for API reads. A key names what was fetched and with which inputs, so the same
 * request made from two places shares one cached response.
 */
export const qk = {
  me: (token?: string) => ["me", token ?? ""] as const,
  tenant: () => ["tenant"] as const,
  dashboard: (period: string) => ["dashboard", period] as const,

  receipts: (params: unknown) => ["receipts", params] as const,
  receipt: (id: string) => ["receipt", id] as const,
  invoices: (params: unknown) => ["invoices", params] as const,
  invoice: (id: string) => ["invoice", id] as const,
  quotations: (params: unknown) => ["quotations", params] as const,
  quotation: (id: string) => ["quotation", id] as const,
  schedules: (params: unknown) => ["schedules", params] as const,
  schedule: (id: string) => ["schedule", id] as const,

  customers: (params: unknown) => ["customers", params] as const,
  customerDocuments: (id: string) => ["customer-documents", id] as const,
  properties: (params: unknown) => ["properties", params] as const,
  property: (id: string) => ["property", id] as const,
  renters: (params: unknown) => ["renters", params] as const,
  renter: (id: string) => ["renter", id] as const,

  team: () => ["team"] as const,
  member: (id: string) => ["member", id] as const,
  memberAssignments: (id: string) => ["member-assignments", id] as const,
  kycQueue: () => ["kyc-queue"] as const,

  notifications: (params: unknown) => ["notifications", params] as const,
  payments: (params: unknown) => ["payments", params] as const,
  audit: (params: unknown) => ["audit", params] as const,
  platform: (what: string, params?: unknown) => ["platform", what, params ?? null] as const,
};
