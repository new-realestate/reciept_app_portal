import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { customersApi } from "../api/customers";
import { receiptsApi } from "../api/receipts";
import { tenantApi } from "../api/tenant";
import { ApiError, apiRequest, extractMessage } from "../lib/apiClient";
import type { Customer, Tenant } from "../lib/types";
import { CustomerPicker } from "../components/documents/CustomerPicker";
import { NewReceiptPage } from "../pages/NewReceiptPage";
import { makeMe, renderWithApp } from "./helpers";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1", name: "Grace", email: "grace@example.com", phone: null, customer_type: "individual", legal_name: null,
    billing_address: null, tax_identification_number: null, notes: null, contact_preference: null, status: "active",
    renter_id: null, created_at: null, ...overrides,
  };
}

describe("API errors", () => {
  it("reads a plain or structured error message", () => {
    expect(extractMessage({ error: { message: "Nope" } }, "fallback")).toBe("Nope");
    expect(extractMessage({ error: { message: { message: "Duplicate", matches: [] } } }, "fallback")).toBe("Duplicate");
    expect(extractMessage({ detail: [{ msg: "bad", loc: ["body"] }] }, "fallback")).toBe("bad");
  });

  it("keeps structured details on the error (duplicate matches)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: { message: "Exists", matches: [{ id: "c1" }] }, status_code: 409 } }), { status: 409 }),
    );
    const err: unknown = await apiRequest("/customers", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(409);
    expect(apiErr.message).toBe("Exists");
    expect(apiErr.data?.matches).toEqual([{ id: "c1" }]);
  });
});

describe("CustomerPicker", () => {
  it("lists matches, flags tenants and selects one", async () => {
    vi.spyOn(customersApi, "listPage").mockResolvedValue({
      items: [customer(), customer({ id: "c2", name: "Kato", renter_id: "r1" })],
      total: 2,
    });
    const onChange = vi.fn();
    render(renderWithApp(<CustomerPicker id="pick" value={null} onChange={onChange} />, { me: makeMe("owner") }));

    const kato = await screen.findByRole("button", { name: /Kato/ });
    expect(kato.textContent).toMatch(/Tenant/);
    await userEvent.click(kato);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));
  });
});

describe("NewReceiptPage", () => {
  it("won't issue a receipt until the payment is confirmed as received", async () => {
    vi.spyOn(tenantApi, "getMine").mockResolvedValue({ default_currency: "UGX" } as Tenant);
    vi.spyOn(customersApi, "listPage").mockResolvedValue({ items: [customer()], total: 1 });
    const create = vi.spyOn(receiptsApi, "create").mockResolvedValue({ id: "r1", reference_number: "RCT-2026-000001" } as never);
    const user = userEvent.setup();
    render(renderWithApp(<NewReceiptPage />, { me: makeMe("staff") }));

    await user.click(await screen.findByRole("button", { name: /Grace/ }));
    await user.type(screen.getByLabelText(/Amount received/), "1500");
    await user.type(screen.getByLabelText(/Reason for payment/), "Consulting");
    await user.click(screen.getByRole("button", { name: "Issue receipt" }));

    expect(await screen.findByText(/Confirm the payment has been received/)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/I confirm this payment has already been received/));
    await user.click(screen.getByRole("button", { name: "Issue receipt" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({ payment_received_confirmed: true, customer_id: "c1", amount_cents: 150000 });
    // A general transaction: no property link unless one is chosen.
    expect(create.mock.calls[0][0].property_id).toBeUndefined();
  });
});
