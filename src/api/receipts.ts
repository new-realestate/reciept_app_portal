import { apiRequest } from "../lib/apiClient";
import type {
  DeliveryAttempt,
  Receipt,
  ReceiptCreatePayload,
  ReceiptDetail,
  ReceiptListFilters,
  SendReceiptPayload,
} from "../lib/types";

export const receiptsApi = {
  list: (filters: ReceiptListFilters = {}) =>
    apiRequest<Receipt[]>("/receipts", {
      query: {
        payer_name: filters.payer_name,
        date_from: filters.date_from,
        date_to: filters.date_to,
        amount_cents: filters.amount_cents,
        status: filters.status,
      },
    }),

  get: (id: string) => apiRequest<ReceiptDetail>(`/receipts/${id}`),

  create: (payload: ReceiptCreatePayload) => apiRequest<Receipt>("/receipts", { method: "POST", body: payload }),

  send: (id: string, payload: SendReceiptPayload) =>
    apiRequest<DeliveryAttempt[]>(`/receipts/${id}/send`, { method: "POST", body: payload }),

  resend: (id: string, payload: SendReceiptPayload) =>
    apiRequest<DeliveryAttempt[]>(`/receipts/${id}/resend`, { method: "POST", body: payload }),

  hostedViewUrl: (token: string) => `${import.meta.env.VITE_API_BASE_URL}/r/${token}`,
};
