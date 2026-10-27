import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { customersApi } from "../../api/customers";
import { invoicesApi, quotationsApi } from "../../api/documents";
import { tenantApi } from "../../api/tenant";
import { ApiError } from "../../lib/apiClient";
import type { Invoice, InvoiceDetail, InvoicePayload, Quotation, QuotationPayload } from "../../lib/documentTypes";
import { centsFromInput, inputFromCents, todayISO } from "../../lib/format";
import type { Customer, PropertyContext } from "../../lib/types";
import { Alert, Button, ButtonLink, Card, CardHeader, Field, Input, SegmentedControl, Textarea } from "../ui/ui";
import { useToast } from "../ToastContext";
import { LineItemsEditor, type DiscountMode } from "./LineItemsEditor";
import { emptyRow, estimateTotals, rowsFromLineItems, rowsToPayload, type LineRow } from "./lineItems";
import { CustomerPicker } from "./CustomerPicker";
import { contextPayload, PropertyContextPicker } from "./PropertyContextPicker";

type Kind = "invoice" | "quotation";

/**
 * One form for creating and editing both invoices and quotations: the two documents share
 * the customer, line items, discount and tax; they differ only in the date and text fields.
 */
export function DocumentForm({ kind, existing }: { kind: Kind; existing?: Invoice | Quotation }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCustomer = existing ? null : params.get("customer");
  const { notify } = useToast();
  const isInvoice = kind === "invoice";
  const base = isInvoice ? "/invoices" : "/quotations";
  const noun = isInvoice ? "invoice" : "quotation";

  const inv = isInvoice ? (existing as Invoice | undefined) : undefined;
  const quo = !isInvoice ? (existing as Quotation | undefined) : undefined;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerFailed, setCustomerFailed] = useState(false);
  const [context, setContext] = useState<PropertyContext>({});
  const [defaultCurrency, setDefaultCurrency] = useState("UGX");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const customerId = customer?.id ?? "";
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(quo?.description ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "");
  const [issueDate, setIssueDate] = useState(existing?.issue_date ?? todayISO());
  const [dueDate, setDueDate] = useState(inv?.due_date ?? quo?.valid_until ?? todayISO(isInvoice ? 14 : 30));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [paymentInstructions, setPaymentInstructions] = useState(inv?.payment_instructions ?? "");
  const [terms, setTerms] = useState(quo?.terms ?? "");
  const [internalNotes, setInternalNotes] = useState(quo?.internal_notes ?? "");
  const [remindersEnabled, setRemindersEnabled] = useState(inv?.reminders_enabled ?? true);

  const [rows, setRows] = useState<LineRow[]>(() => (existing ? rowsFromLineItems(existing.line_items) : [emptyRow()]));
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    existing?.discount_percent ? "percent" : existing && existing.discount_cents > 0 ? "fixed" : "none",
  );
  const [discountValue, setDiscountValue] = useState(
    existing?.discount_percent ? String(Number(existing.discount_percent)) : existing && existing.discount_cents > 0 ? inputFromCents(existing.discount_cents) : "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const customerToLoad = existing?.customer_id ?? presetCustomer;
    if (customerToLoad) customersApi.get(customerToLoad).then(setCustomer).catch(() => setCustomerFailed(true));
    tenantApi
      .getMine()
      .then((t) => {
        setDefaultCurrency(t.default_currency);
        setCurrency((c) => c || t.default_currency);
      })
      .catch(() => undefined);
  }, [existing, presetCustomer]);

  const activeCurrency = currency || defaultCurrency;
  const totals = useMemo(() => estimateTotals(rows, discountMode, discountValue), [rows, discountMode, discountValue]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (customerMode === "existing" && !customerId) next.customerId = "Choose a customer.";
    if (customerMode === "new") {
      if (!customerName.trim()) next.customerName = "Customer name is required.";
      if (!customerEmail.trim() && !customerPhone.trim()) next.customerContact = "Provide an email or phone number.";
    }
    if (!dueDate) next.dueDate = isInvoice ? "Choose a due date." : "Choose how long this quotation is valid.";
    else if (dueDate < issueDate) next.dueDate = isInvoice ? "The due date can't be before the issue date." : "The validity date can't be before the issue date.";
    rows.forEach((r, i) => {
      if (!r.description.trim()) next[`line_${i}_description`] = "Describe this item.";
      const qty = Number.parseFloat(r.quantity);
      if (!Number.isFinite(qty) || qty <= 0) next[`line_${i}_quantity`] = "Must be above 0.";
      if (r.unitPrice.trim() === "" || centsFromInput(r.unitPrice) < 0) next[`line_${i}_price`] = "Enter a price.";
      if (r.taxRate.trim() !== "") {
        const t = Number.parseFloat(r.taxRate);
        if (!Number.isFinite(t) || t < 0 || t > 100) next[`line_${i}_tax`] = "0–100.";
      }
    });
    if (totals.subtotal <= 0) next.lines = "Add at least one item with a price.";
    if (discountMode !== "none") {
      const v = Number.parseFloat(discountValue);
      if (!Number.isFinite(v) || v < 0) next.discount = "Enter a discount.";
      else if (discountMode === "percent" && v > 100) next.discount = "Can't exceed 100%.";
      else if (discountMode === "fixed" && centsFromInput(discountValue) > totals.subtotal) next.discount = "Can't exceed the subtotal.";
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const idMap: Record<string, string> = {
        customerId: "customer_id", customerName: "customer_name", customerContact: "customer_email", dueDate: "due_date",
        discount: "discount-value", lines: "li-desc-0",
      };
      const el = idMap[first] ?? first.replace(/^line_(\d+)_description$/, "li-desc-$1").replace(/^line_(\d+)_quantity$/, "li-qty-$1")
        .replace(/^line_(\d+)_price$/, "li-price-$1").replace(/^line_(\d+)_tax$/, "li-tax-$1");
      document.getElementById(el)?.focus();
    }
    return !first;
  }

  function discountFields() {
    if (discountMode === "percent") return { discount_percent: discountValue.trim(), discount_cents: null };
    if (discountMode === "fixed") return { discount_percent: null, discount_cents: centsFromInput(discountValue) };
    return { discount_percent: null, discount_cents: 0 };
  }

  async function submit(e: FormEvent | null, issueNow: boolean) {
    e?.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const customerPart =
        customerMode === "existing"
          ? { customer_id: customerId }
          : { customer_name: customerName.trim(), customer_email: customerEmail.trim() || undefined, customer_phone: customerPhone.trim() || undefined };
      const common = {
        ...(existing ? {} : contextPayload(context)),
        title: title.trim() || undefined,
        currency: activeCurrency,
        issue_date: issueDate,
        line_items: rowsToPayload(rows),
        ...discountFields(),
        notes: notes.trim() || undefined,
      };

      if (isInvoice) {
        const payload: InvoicePayload = {
          ...customerPart, ...common, due_date: dueDate,
          payment_instructions: paymentInstructions.trim() || undefined,
          reminders_enabled: remindersEnabled,
        };
        let saved: InvoiceDetail;
        if (existing) {
          saved = await invoicesApi.update(existing.id, { ...payload, customer_id: customerId || undefined });
          if (issueNow) saved = await invoicesApi.issue(existing.id);
        } else {
          saved = await invoicesApi.create({ ...payload, issue_now: issueNow });
        }
        notify(saved.status === "issued" ? `Invoice ${saved.number} issued.` : "Draft saved.", "success");
        navigate(`/invoices/${saved.id}`);
      } else {
        const payload: QuotationPayload = {
          ...customerPart, ...common, valid_until: dueDate, description: description.trim() || undefined,
          terms: terms.trim() || undefined, internal_notes: internalNotes.trim() || undefined,
        };
        const saved = existing
          ? await quotationsApi.update(existing.id, { ...payload, customer_id: customerId || undefined })
          : await quotationsApi.create(payload);
        notify("Draft saved.", "success");
        navigate(`/quotations/${saved.id}`);
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : `Could not save the ${noun}.`, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, false)} noValidate>
      <div className="stack">
        <Card>
          <CardHeader
            title={isInvoice ? "Bill to" : "Prepared for"}
            action={
              !existing ? (
                <SegmentedControl
                  label="Customer type"
                  value={customerMode}
                  onChange={setCustomerMode}
                  options={[
                    { value: "existing", label: "Existing customer" },
                    { value: "new", label: "New customer" },
                  ]}
                />
              ) : undefined
            }
          />
          {customerMode === "existing" ? (
            <div className="stack">
              {customerFailed && <Alert tone="warning">This document's customer couldn't be loaded. Reload the page to try again.</Alert>}
              <Field label="Customer" htmlFor="customer_id" required error={errors.customerId}>
                <CustomerPicker
                  id="customer_id"
                  value={customer}
                  invalid={Boolean(errors.customerId)}
                  onChange={(c) => {
                    setCustomer(c);
                    setContext({});
                  }}
                />
              </Field>
            </div>
          ) : (
            <div className="form-grid">
              <Field label="Customer name" htmlFor="customer_name" required error={errors.customerName} className="form-grid-full">
                <Input id="customer_name" autoComplete="off" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="customer_email" error={errors.customerContact} hint="Email or phone is required so the document can be delivered.">
                <Input id="customer_email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="customer_phone" hint="International format, e.g. +256701234567">
                <Input id="customer_phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </Field>
            </div>
          )}
        </Card>

        {!existing && (
          <Card>
            <CardHeader title="Property" description="Optional: link this document to a property, unit or tenancy." />
            <PropertyContextPicker customer={customerMode === "existing" ? customer : null} value={context} onChange={setContext} />
          </Card>
        )}

        <Card>
          <CardHeader title="Details" />
          <div className="form-grid">
            <Field label={isInvoice ? "Invoice title" : "Quotation title"} htmlFor="doc_title" className="form-grid-full" hint={isInvoice ? "e.g. “Rent for November 2026”" : "e.g. “Roof repair estimate”"}>
              <Input id="doc_title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
            </Field>
            {!isInvoice && (
              <Field label="Description" htmlFor="doc_description" className="form-grid-full">
                <Textarea id="doc_description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            )}
            <Field label="Issue date" htmlFor="issue_date" required>
              <Input id="issue_date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
            <Field label={isInvoice ? "Payment due date" : "Valid until"} htmlFor="due_date" required error={errors.dueDate}>
              <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Currency" htmlFor="currency" hint="Three-letter code, e.g. UGX, KES, USD.">
              <Input id="currency" value={activeCurrency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Items" />
          <LineItemsEditor
            rows={rows}
            onChange={setRows}
            currency={activeCurrency}
            totals={totals}
            discountMode={discountMode}
            discountValue={discountValue}
            onDiscountChange={(m, v) => {
              setDiscountMode(m);
              setDiscountValue(v);
            }}
            errors={errors}
          />
        </Card>

        <Card>
          <CardHeader title={isInvoice ? "Payment instructions and notes" : "Terms and notes"} />
          <div className="form-grid">
            {isInvoice ? (
              <Field label="Payment instructions" htmlFor="payment_instructions" className="form-grid-full" hint="Shown on the invoice, e.g. bank account or mobile money number.">
                <Textarea id="payment_instructions" rows={3} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} />
              </Field>
            ) : (
              <Field label="Terms and conditions" htmlFor="terms" className="form-grid-full">
                <Textarea id="terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </Field>
            )}
            <Field label="Notes" htmlFor="notes" className="form-grid-full" hint="Visible to the customer.">
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {!isInvoice && (
              <Field label="Internal notes" htmlFor="internal_notes" className="form-grid-full" hint="Private. Never shown to the customer or included in the PDF.">
                <Textarea id="internal_notes" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </Field>
            )}
            {isInvoice && (
              <label className="checkbox-row form-grid-full">
                <input type="checkbox" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
                <span>
                  Send automatic payment reminders for this invoice
                  <small>Uses your business reminder settings. Reminders stop once the invoice is paid or cancelled.</small>
                </span>
              </label>
            )}
          </div>

          <div className="action-bar">
            <ButtonLink to={existing ? `${base}/${existing.id}` : base} variant="ghost">
              Cancel
            </ButtonLink>
            <Button type="submit" variant="secondary" isLoading={isSubmitting}>
              Save draft
            </Button>
            {isInvoice && (
              <Button type="button" isLoading={isSubmitting} onClick={() => submit(null, true)}>
                Save and issue
              </Button>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
