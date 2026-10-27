import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/AuthContext";
import { StaticAccessProvider } from "../auth/AccessContext";
import { ToastProvider } from "../components/ToastContext";
import type { Me, Permission, UserRole } from "../lib/types";

export const STAFF_DEFAULTS: Permission[] = [
  "customers.view",
  "customers.manage",
  "renters.manage",
  "receipts.issue",
  "invoices.issue",
  "invoices.record_payment",
  "quotations.issue",
  "documents.view",
];

export function makeMe(role: UserRole, overrides: Partial<Me> = {}): Me {
  const isManager = role !== "staff";
  return {
    id: `${role}-id`,
    full_name: role === "staff" ? "Sam Staff" : "Olivia Owner",
    email: `${role}@example.com`,
    role,
    signature_image_url: null,
    phone: null,
    permissions: isManager ? [...STAFF_DEFAULTS, "renters.kyc_review", "reports.view"] : STAFF_DEFAULTS,
    is_manager: isManager,
    assigned_property_ids: [],
    business: { id: "t1", name: "Demo Business", logo_url: null, brand_color: null, default_currency: "UGX", timezone: "Africa/Kampala" },
    ...overrides,
  };
}

/** An unsigned JWT that jwt-decode accepts; the portal only reads its claims. */
export function fakeToken(role: UserRole) {
  const encode = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "none" })}.${encode({ sub: `${role}-id`, tenant_id: "t1", role, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

export function renderWithApp(ui: ReactNode, { me, path = "/" }: { me: Me; path?: string }) {
  localStorage.setItem("receipt_portal_token", fakeToken(me.role));
  // A fresh cache per test so nothing leaks between them.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <StaticAccessProvider me={me}>{ui}</StaticAccessProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
