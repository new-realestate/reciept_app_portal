// Types mirror the FastAPI schemas in app/schemas/*.py and app/models/enums.py

export type UserRole = "owner" | "admin" | "staff";

export type ReceiptStatus = "issued" | "voided" | "refunded";

export type DeliveryChannel = "email" | "sms";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "bounced" | "failed" | "opened";

export type PaymentMethodType = "cash" | "bank_transfer" | "mobile_money" | "cheque" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
  cheque: "Cheque",
  other: "Other",
};

export interface JwtClaims {
  sub: string;
  /** null for a platform super admin who isn't acting as a business. */
  tenant_id: string | null;
  role: UserRole;
  exp: number;
  /** Platform super admin. */
  sa?: boolean;
  /** Set on the short-lived token a super admin gets when acting as a business. */
  imp?: boolean;
  act_tenant_id?: string;
  act_tenant_name?: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  tenantId: string | null;
  role: UserRole;
  email: string;
  isSuperadmin: boolean;
  /** The business a super admin is acting as, or null. */
  impersonating: { tenantId: string; businessName: string } | null;
}

/** GET /users/me */
export interface Me {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  signature_image_url: string | null;
  phone: string | null;
  /** Effective permission flags; owners and admins hold all of them. */
  permissions: Permission[];
  is_manager: boolean;
  /** Properties a staff member may manage (empty for owners/admins, who see every property). */
  assigned_property_ids: string[];
  /** The business the member works in: shown in the portal header and used for the accent colour. */
  business: BusinessBranding | null;
}

export interface BusinessBranding {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  default_currency: string;
  timezone: string;
}

export type Permission =
  | "customers.view"
  | "customers.manage"
  | "renters.manage"
  | "renters.kyc_review"
  | "receipts.issue"
  | "invoices.issue"
  | "invoices.record_payment"
  | "quotations.issue"
  | "documents.view"
  | "reports.view";

export interface SignupPayload {
  business_name: string;
  full_name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  tenant_id: string;
  user_id: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Tenant {
  id: string;
  business_name: string;
  logo_url: string | null;
  brand_color: string | null;
  po_box: string | null;
  physical_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  default_currency: string;
  receipt_template: ReceiptTemplate;
  timezone?: string;
}

export type ReceiptTemplate = "classic" | "modern";

export interface TenantUpdatePayload {
  receipt_template?: ReceiptTemplate;
  /** #rrggbb, or null to go back to the default colour. */
  brand_color?: string | null;
  business_name?: string;
  po_box?: string;
  physical_address?: string;
  contact_phone?: string;
  contact_email?: string;
  bank_name?: string;
  bank_account_number?: string;
}

export type CustomerType = "individual" | "business";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customer_type: CustomerType;
  legal_name: string | null;
  billing_address: string | null;
  tax_identification_number: string | null;
  notes: string | null;
  contact_preference: string | null;
  status: "active" | "archived";
  /** Set when this customer also has a tenant profile. */
  renter_id: string | null;
  created_at: string | null;
}

export interface CustomerCreatePayload {
  name: string;
  email?: string;
  phone?: string;
  customer_type?: CustomerType;
  legal_name?: string;
  billing_address?: string;
  tax_identification_number?: string;
  notes?: string;
  /** Create a separate record even though one with the same email/phone exists. */
  allow_duplicate?: boolean;
}

export type CustomerUpdatePayload = Partial<Omit<CustomerCreatePayload, "allow_duplicate">>;

export interface CustomerMatches {
  exact: Customer[];
  possible: Customer[];
}

export interface CustomerDocumentSummary {
  id: string;
  kind: "receipt" | "invoice" | "quotation";
  number: string | null;
  status: string;
  date: string;
  currency: string;
  amount_cents: number;
  outstanding_cents: number | null;
  property_id: string | null;
}

export interface CustomerDocuments {
  customer: Customer;
  receipts: CustomerDocumentSummary[];
  invoices: CustomerDocumentSummary[];
  quotations: CustomerDocumentSummary[];
  outstanding_by_currency: Record<string, number>;
}

/** Optional link from a document to a property, unit or tenancy (all empty for general transactions). */
export interface PropertyContext {
  property_id?: string | null;
  unit_id?: string | null;
  tenancy_id?: string | null;
}

export interface ReceiptCreatePayload extends PropertyContext {
  /** The issuer confirms the money has already been received. */
  payment_received_confirmed: true;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  amount_cents: number;
  currency?: string;
  reason: string;
  payment_method: PaymentMethodType;
  payment_reference?: string;
  paid_at: string; // ISO date
  balance_cents?: number;
  corrects_receipt_id?: string;
}

export interface Receipt {
  id: string;
  reference_number: string;
  status: ReceiptStatus;
  currency: string;
  amount_cents: number;
  amount_in_words: string;
  balance_cents: number;
  reason: string;
  payment_method: PaymentMethodType;
  payment_reference: string | null;
  paid_at: string;
  customer_id: string;
  issuer_printed_name: string;
  signature_image_url: string | null;
  corrects_receipt_id: string | null;
  hosted_view_token: string;
  pdf_url: string | null;
  created_at: string;
  property_id: string | null;
  unit_id: string | null;
  tenancy_id: string | null;
  issued_by_user_id: string | null;
}

export interface DeliveryAttempt {
  id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  recipient: string;
  provider: string | null;
  provider_response: Record<string, unknown> | null;
  attempt_number: number;
  attempted_at: string;
  resolved_at: string | null;
}

export interface ReceiptDetail extends Receipt {
  delivery_attempts: DeliveryAttempt[];
  customer_name: string | null;
  customer_phone: string | null;
  business_name: string | null;
}

export interface SendReceiptPayload {
  channels: DeliveryChannel[];
  email_mode?: "attachment" | "link";
}

export interface ReceiptListFilters {
  payer_name?: string;
  date_from?: string;
  date_to?: string;
  amount_cents?: number;
  status?: ReceiptStatus;
  customer_id?: string;
  property_id?: string;
}

export interface ApiErrorBody {
  detail?: string | { msg: string; loc: (string | number)[] }[];
  error?: { message?: string | ({ message?: string } & Record<string, unknown>); status_code?: number };
}
