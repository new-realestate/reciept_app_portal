import { API_BASE_URL, apiRequest } from "../lib/apiClient";
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
        customer_id: filters.customer_id,
        property_id: filters.property_id,
      },
    }),

  /** One page of results plus the total number of matches (X-Total-Count). */
  listPage: async (filters: ReceiptListFilters, limit: number, offset: number) => {
    let total = 0;
    const items = await apiRequest<Receipt[]>("/receipts", {
      query: {
        payer_name: filters.payer_name,
        date_from: filters.date_from,
        date_to: filters.date_to,
        amount_cents: filters.amount_cents,
        status: filters.status,
        customer_id: filters.customer_id,
        property_id: filters.property_id,
        limit,
        offset,
      },
      onResponse: (r) => {
        total = Number(r.headers.get("X-Total-Count") ?? 0);
      },
    });
    return { items, total: total || items.length };
  },

  get: (id: string) => apiRequest<ReceiptDetail>(`/receipts/${id}`),

  create: (payload: ReceiptCreatePayload) => apiRequest<Receipt>("/receipts", { method: "POST", body: payload }),

  send: (id: string, payload: SendReceiptPayload) =>
    apiRequest<DeliveryAttempt[]>(`/receipts/${id}/send`, { method: "POST", body: payload }),

  resend: (id: string, payload: SendReceiptPayload) =>
    apiRequest<DeliveryAttempt[]>(`/receipts/${id}/resend`, { method: "POST", body: payload }),

  hostedViewUrl: (token: string) => `${API_BASE_URL}/r/${token}`,
};
