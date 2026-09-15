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
  tenant_id: string;
  role: UserRole;
  exp: number;
}

export interface AuthSession {
  token: string;
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

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
  po_box: string | null;
  physical_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  default_currency: string;
}

export interface TenantUpdatePayload {
  business_name?: string;
  po_box?: string;
  physical_address?: string;
  contact_phone?: string;
  contact_email?: string;
  bank_name?: string;
  bank_account_number?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CustomerCreatePayload {
  name: string;
  email?: string;
  phone?: string;
}

export interface ReceiptCreatePayload {
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
}

export interface ApiErrorBody {
  detail?: string | { msg: string; loc: (string | number)[] }[];
}
