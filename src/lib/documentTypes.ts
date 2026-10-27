import type { DeliveryChannel, PaymentMethodType, PropertyContext } from "./types";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LineItemInput {
  description: string;
  quantity: string; // decimal sent as a string so no float rounding happens on the wire
  unit_price_cents: number;
  tax_rate?: string | null;
}

export interface LineItem {
  id: string;
  position: number;
  description: string;
  quantity: string;
  unit_price_cents: number;
  tax_rate: string | null;
  line_total_cents: number;
}

export interface CustomerInline extends PropertyContext {
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

/* ---------- Invoices ---------- */

export type InvoiceStatus = "draft" | "issued" | "cancelled";
export type InvoiceDisplayStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";

export interface Invoice extends PropertyContext {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  display_status: InvoiceDisplayStatus;
  customer_id: string;
  customer_name: string | null;
  title: string | null;
  currency: string;
  issue_date: string;
  due_date: string;
  subtotal_cents: number;
  discount_percent: string | null;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  outstanding_cents: number;
  days_overdue: number;
  notes: string | null;
  payment_instructions: string | null;
  reminders_enabled: boolean;
  quotation_id: string | null;
  public_url: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  line_items: LineItem[];
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  receipt_id: string;
  amount_cents: number;
  paid_at: string;
  method: string;
  reference: string | null;
  created_at: string;
}

export interface InvoiceDetail extends Invoice {
  payments: InvoicePayment[];
}

export interface InvoicePayload extends CustomerInline {
  title?: string;
  currency?: string;
  issue_date?: string;
  due_date: string;
  line_items: LineItemInput[];
  discount_percent?: string | null;
  discount_cents?: number | null;
  notes?: string;
  payment_instructions?: string;
  reminders_enabled?: boolean;
  issue_now?: boolean;
}

export interface PaymentPayload {
  amount_cents: number;
  paid_at: string;
  payment_method: PaymentMethodType;
  payment_reference?: string;
}

export interface PaymentRecorded {
  invoice: InvoiceDetail;
  payment: InvoicePayment;
  receipt_id: string;
  receipt_url: string;
  replayed: boolean;
}

export interface InvoiceListFilters {
  status?: string;
  q?: string;
  customer_id?: string;
  property_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/* ---------- Quotations ---------- */

export type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "cancelled";

export interface Quotation extends PropertyContext {
  id: string;
  number: string | null;
  status: QuotationStatus;
  display_status: QuotationStatus;
  customer_id: string;
  customer_name: string | null;
  title: string | null;
  description: string | null;
  currency: string;
  issue_date: string;
  valid_until: string;
  subtotal_cents: number;
  discount_percent: string | null;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  terms: string | null;
  notes: string | null;
  internal_notes: string | null;
  public_url: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  accepted_name: string | null;
  response_comment: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  line_items: LineItem[];
}

export interface QuotationPayload extends CustomerInline {
  title?: string;
  description?: string;
  currency?: string;
  issue_date?: string;
  valid_until: string;
  line_items: LineItemInput[];
  discount_percent?: string | null;
  discount_cents?: number | null;
  terms?: string;
  notes?: string;
  internal_notes?: string;
}

export interface ConvertPayload {
  issue_date?: string;
  due_date: string;
  payment_instructions?: string;
  issue_now?: boolean;
}

/* ---------- Schedules ---------- */

export type Frequency = "once" | "weekly" | "monthly" | "quarterly" | "annually";
export type ScheduleStatus = "active" | "paused" | "completed" | "cancelled";
export type OccurrenceStatus = "expected" | "invoiced" | "paid" | "skipped";

export interface Occurrence {
  id: string;
  schedule_id: string;
  seq: number;
  due_date: string;
  amount_cents: number;
  amount_paid_cents: number;
  status: OccurrenceStatus;
  invoice_id: string | null;
  invoice_number: string | null;
  days_until_due: number;
}

export interface Schedule extends PropertyContext {
  id: string;
  customer_id: string;
  customer_name: string | null;
  description: string;
  reference_label: string | null;
  amount_cents: number;
  currency: string;
  frequency: Frequency;
  first_due_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  status: ScheduleStatus;
  reminders_enabled: boolean;
  reminder_overrides: Record<string, unknown> | null;
  auto_invoice: boolean;
  next_due_date: string | null;
  next_amount_cents: number | null;
  created_at: string;
}

export interface ScheduleDetail extends Schedule {
  occurrences: Occurrence[];
}

export interface SchedulePayload extends CustomerInline {
  description: string;
  reference_label?: string;
  amount_cents: number;
  currency?: string;
  frequency: Frequency;
  first_due_date: string;
  end_date?: string;
  max_occurrences?: number;
  reminders_enabled?: boolean;
  auto_invoice?: boolean;
}

/* ---------- Payments, reminders, notifications ---------- */

export interface UpcomingPayment {
  kind: "invoice" | "occurrence";
  id: string;
  customer_id: string;
  customer_name: string | null;
  description: string;
  due_date: string;
  amount_cents: number;
  currency: string;
  status: "overdue" | "due_today" | "upcoming";
  days_until_due: number;
  days_overdue: number;
  invoice_id: string | null;
  invoice_number: string | null;
  schedule_id: string | null;
  occurrence_id: string | null;
}

export interface UpcomingFilters {
  status?: string;
  window_days?: number;
  customer_id?: string;
  schedule_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface ReminderSettings {
  enabled: boolean;
  offsets: number[];
  channels: DeliveryChannel[];
  send_hour: number;
  notify_business: boolean;
  timezone: string;
}

export interface NotificationAttempt {
  attempt_no: number;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  response: Record<string, unknown> | null;
  attempted_at: string;
}

export type NotificationStatus = "scheduled" | "sending" | "sent" | "failed" | "skipped" | "cancelled";

export interface NotificationEvent {
  id: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  channel: DeliveryChannel;
  recipient_party: string;
  recipient: string | null;
  scheduled_for: string;
  status: NotificationStatus;
  skip_reason: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
  attempt_log: NotificationAttempt[];
}

export interface CurrencyTotals {
  invoiced_cents: number;
  received_cents: number;
  received_on_invoices_cents: number;
  outstanding_cents: number;
  overdue_cents: number;
  overdue_count: number;
  due_today_cents: number;
  due_today_count: number;
  upcoming_7_cents: number;
  upcoming_7_count: number;
  upcoming_30_cents: number;
  upcoming_30_count: number;
  pending_quotations_cents: number;
  pending_quotations_count: number;
}

export interface DashboardSummary {
  period: string;
  period_start: string | null;
  period_end: string;
  as_of: string;
  default_currency: string;
  by_currency: Record<string, CurrencyTotals>;
  recent_payments: {
    id: string;
    reference_number: string;
    customer_name: string | null;
    amount_cents: number;
    currency: string;
    paid_at: string;
  }[];
  recent_activity: { action: string; entity_type: string; entity_id: string | null; created_at: string }[];
}
