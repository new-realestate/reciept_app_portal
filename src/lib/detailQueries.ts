import { customersApi } from "../api/customers";
import { invoicesApi, quotationsApi, schedulesApi } from "../api/documents";
import { propertiesApi } from "../api/properties";
import { receiptsApi } from "../api/receipts";
import { rentersApi } from "../api/renters";
import { queryClient } from "./queryClient";
import { qk } from "./queryKeys";

/**
 * Detail-page reads, defined once so a page and a hover-prefetch for it share the same
 * cache entry (same key, same data shape).
 */
export const detailQueries = {
  receipt: (id: string) => ({ queryKey: qk.receipt(id), queryFn: () => receiptsApi.get(id) }),
  invoice: (id: string) => ({
    queryKey: qk.invoice(id),
    queryFn: async () => {
      const [doc, events] = await Promise.all([invoicesApi.get(id), invoicesApi.notifications(id)]);
      return { doc, events };
    },
  }),
  quotation: (id: string) => ({
    queryKey: qk.quotation(id),
    queryFn: async () => {
      const [doc, events] = await Promise.all([quotationsApi.get(id), quotationsApi.notifications(id)]);
      return { doc, events };
    },
  }),
  schedule: (id: string) => ({ queryKey: qk.schedule(id), queryFn: () => schedulesApi.get(id) }),
  customer: (id: string) => ({ queryKey: qk.customerDocuments(id), queryFn: () => customersApi.documents(id) }),
  property: (id: string) => ({ queryKey: qk.property(id), queryFn: () => propertiesApi.get(id) }),
  renter: (id: string) => ({ queryKey: qk.renter(id), queryFn: () => rentersApi.get(id) }),
};

const ROUTES: [RegExp, (id: string) => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }][] = [
  [/^\/receipts\/([0-9a-f-]{36})$/, detailQueries.receipt],
  [/^\/invoices\/([0-9a-f-]{36})$/, detailQueries.invoice],
  [/^\/quotations\/([0-9a-f-]{36})$/, detailQueries.quotation],
  [/^\/schedules\/([0-9a-f-]{36})$/, detailQueries.schedule],
  [/^\/customers\/([0-9a-f-]{36})$/, detailQueries.customer],
  [/^\/properties\/([0-9a-f-]{36})$/, detailQueries.property],
  [/^\/tenants\/([0-9a-f-]{36})$/, detailQueries.renter],
];

/** Starts loading a detail page's data (e.g. on row hover). No-op if cached and fresh. */
export function prefetchPath(path: string) {
  for (const [pattern, query] of ROUTES) {
    const match = pattern.exec(path);
    if (match) {
      void queryClient.prefetchQuery(query(match[1]));
      return;
    }
  }
}
