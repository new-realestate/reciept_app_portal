import { apiRequest, downloadAuthedFile } from "../lib/apiClient";
import type { DeliveryChannel } from "../lib/types";
import type {
  ConvertPayload,
  DashboardSummary,
  Invoice,
  InvoiceDetail,
  InvoiceListFilters,
  InvoicePayload,
  NotificationEvent,
  Page,
  PaymentPayload,
  PaymentRecorded,
  Quotation,
  QuotationPayload,
  ReminderSettings,
  Schedule,
  ScheduleDetail,
  SchedulePayload,
  Occurrence,
  UpcomingFilters,
  UpcomingPayment,
} from "../lib/documentTypes";

type Query = Record<string, string | number | undefined | null>;

export const invoicesApi = {
  list: (filters: InvoiceListFilters) =>
    apiRequest<Page<Invoice>>("/invoices", { query: filters as Query }),
  get: (id: string) => apiRequest<InvoiceDetail>(`/invoices/${id}`),
  create: (payload: InvoicePayload) => apiRequest<InvoiceDetail>("/invoices", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<InvoicePayload>) =>
    apiRequest<InvoiceDetail>(`/invoices/${id}`, { method: "PATCH", body: payload }),
  issue: (id: string, channels: DeliveryChannel[] = []) =>
    apiRequest<InvoiceDetail>(`/invoices/${id}/issue`, { method: "POST", body: { channels } }),
  cancel: (id: string, reason?: string) =>
    apiRequest<InvoiceDetail>(`/invoices/${id}/cancel`, { method: "POST", body: { reason } }),
  // The key makes a double-click or network retry safe: the server records the payment once.
  recordPayment: (id: string, payload: PaymentPayload, idempotencyKey: string) =>
    apiRequest<PaymentRecorded>(`/invoices/${id}/payments`, {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  send: (id: string, channels: DeliveryChannel[]) =>
    apiRequest<NotificationEvent[]>(`/invoices/${id}/send`, { method: "POST", body: { channels } }),
  remind: (id: string, channels: DeliveryChannel[]) =>
    apiRequest<NotificationEvent[]>(`/invoices/${id}/remind`, { method: "POST", body: { channels } }),
  updateReminders: (id: string, body: { enabled?: boolean; offsets?: number[]; channels?: string[]; send_hour?: number }) =>
    apiRequest<InvoiceDetail>(`/invoices/${id}/reminders`, { method: "PATCH", body }),
  rotateLink: (id: string) => apiRequest<InvoiceDetail>(`/invoices/${id}/rotate-link`, { method: "POST" }),
  revokeLink: (id: string) => apiRequest<InvoiceDetail>(`/invoices/${id}/revoke-link`, { method: "POST" }),
  notifications: (id: string) => apiRequest<NotificationEvent[]>(`/invoices/${id}/notifications`),
  downloadPdf: (id: string, name: string) => downloadAuthedFile(`/invoices/${id}/pdf`, `${name}.pdf`),
};

export const quotationsApi = {
  list: (filters: InvoiceListFilters) =>
    apiRequest<Page<Quotation>>("/quotations", { query: filters as Query }),
  get: (id: string) => apiRequest<Quotation>(`/quotations/${id}`),
  create: (payload: QuotationPayload) => apiRequest<Quotation>("/quotations", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<QuotationPayload>) =>
    apiRequest<Quotation>(`/quotations/${id}`, { method: "PATCH", body: payload }),
  send: (id: string, channels: DeliveryChannel[]) =>
    apiRequest<Quotation>(`/quotations/${id}/send`, { method: "POST", body: { channels } }),
  cancel: (id: string) => apiRequest<Quotation>(`/quotations/${id}/cancel`, { method: "POST" }),
  convert: (id: string, payload: ConvertPayload) =>
    apiRequest<InvoiceDetail>(`/quotations/${id}/convert`, { method: "POST", body: payload }),
  rotateLink: (id: string) => apiRequest<Quotation>(`/quotations/${id}/rotate-link`, { method: "POST" }),
  notifications: (id: string) => apiRequest<NotificationEvent[]>(`/quotations/${id}/notifications`),
  downloadPdf: (id: string, name: string) => downloadAuthedFile(`/quotations/${id}/pdf`, `${name}.pdf`),
};

export const schedulesApi = {
  list: (filters: { status?: string; customer_id?: string; limit?: number; offset?: number }) =>
    apiRequest<Page<Schedule>>("/schedules", { query: filters as Query }),
  get: (id: string) => apiRequest<ScheduleDetail>(`/schedules/${id}`),
  create: (payload: SchedulePayload) => apiRequest<ScheduleDetail>("/schedules", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<SchedulePayload>) =>
    apiRequest<ScheduleDetail>(`/schedules/${id}`, { method: "PATCH", body: payload }),
  pause: (id: string) => apiRequest<ScheduleDetail>(`/schedules/${id}/pause`, { method: "POST" }),
  resume: (id: string) => apiRequest<ScheduleDetail>(`/schedules/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => apiRequest<ScheduleDetail>(`/schedules/${id}/cancel`, { method: "POST" }),
  updateReminders: (id: string, body: { enabled?: boolean; offsets?: number[]; channels?: string[]; send_hour?: number }) =>
    apiRequest<ScheduleDetail>(`/schedules/${id}/reminders`, { method: "PATCH", body }),
  createInvoice: (occurrenceId: string, body: { issue_now?: boolean; due_date?: string } = {}) =>
    apiRequest<InvoiceDetail>(`/schedules/occurrences/${occurrenceId}/create-invoice`, { method: "POST", body }),
  skip: (occurrenceId: string) =>
    apiRequest<Occurrence>(`/schedules/occurrences/${occurrenceId}/skip`, { method: "POST" }),
};

export const paymentsApi = {
  upcoming: (filters: UpcomingFilters) =>
    apiRequest<Page<UpcomingPayment>>("/payments/upcoming", { query: filters as Query }),
  overdue: (filters: { customer_id?: string; limit?: number; offset?: number } = {}) =>
    apiRequest<Page<UpcomingPayment>>("/payments/overdue", { query: filters as Query }),
};

export const dashboardApi = {
  summary: (period: string) => apiRequest<DashboardSummary>("/dashboard/summary", { query: { period } }),
};

export const notificationsApi = {
  list: (filters: { status?: string; kind?: string; subject_type?: string; channel?: string; limit?: number; offset?: number }) =>
    apiRequest<Page<NotificationEvent>>("/notifications", { query: filters as Query }),
  retry: (id: string) => apiRequest<NotificationEvent>(`/notifications/${id}/retry`, { method: "POST" }),
  cancel: (id: string) => apiRequest<NotificationEvent>(`/notifications/${id}/cancel`, { method: "POST" }),
  getSettings: () => apiRequest<ReminderSettings>("/reminder-settings"),
  updateSettings: (body: Partial<Omit<ReminderSettings, "timezone">>) =>
    apiRequest<ReminderSettings>("/reminder-settings", { method: "PUT", body }),
};
