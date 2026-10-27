import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { customersApi } from "../api/customers";
import { receiptsApi } from "../api/receipts";
import { tenantApi } from "../api/tenant";
import { ApiError } from "../lib/apiClient";
import { centsFromInput } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type Customer, type PaymentMethodType, type PropertyContext } from "../lib/types";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  PrefixedInput,
  SegmentedControl,
  Select,
  Textarea,
} from "../components/ui/ui";
import { useToast } from "../components/ToastContext";
import { CustomerPicker } from "../components/documents/CustomerPicker";
import { contextPayload, PropertyContextPicker } from "../components/documents/PropertyContextPicker";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethodType, string][];

// Field ids in on-screen order, used to move focus to the first invalid field.
const FIELD_ORDER = ["customerId", "customerName", "customerContact", "amount", "paidAt", "reason", "confirmed"] as const;
const FIELD_ELEMENT_IDS: Record<(typeof FIELD_ORDER)[number], string> = {
  customerId: "customer_id",
  customerName: "customer_name",
  customerContact: "customer_email",
  amount: "amount",
  paidAt: "paid_at",
  reason: "reason",
  confirmed: "payment_confirmed",
};

export function NewReceiptPage() {
  useDocumentTitle("New receipt");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { notify } = useToast();

  const [currency, setCurrency] = useState<string | null>(null);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [context, setContext] = useState<PropertyContext>({});
  const [confirmed, setConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState("");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const presetCustomer = params.get("customer");
    if (presetCustomer) customersApi.get(presetCustomer).then(setCustomer).catch(() => undefined);
  }, [params]);

  useEffect(() => {
    tenantApi
      .getMine()
      .then((t) => setCurrency(t.default_currency))
      .catch(() => undefined);
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (customerMode === "existing" && !customer) next.customerId = "Choose a payer.";
    if (customerMode === "new") {
      if (!customerName.trim()) next.customerName = "Payer name is required.";
      if (!customerEmail.trim() && !customerPhone.trim()) next.customerContact = "Provide an email or phone number.";
    }
    if (!amount || centsFromInput(amount) <= 0) next.amount = "Enter an amount greater than zero.";
    if (!reason.trim()) next.reason = "Describe the reason for payment.";
    if (!paidAt) next.paidAt = "Select the date paid.";
    else if (paidAt > new Date().toISOString().slice(0, 10)) next.paidAt = "The payment date can't be in the future.";
    if (!confirmed) next.confirmed = "Confirm the payment has been received before issuing the receipt.";
    setErrors(next);

    const firstInvalid = FIELD_ORDER.find((key) => next[key]);
    if (firstInvalid) document.getElementById(FIELD_ELEMENT_IDS[firstInvalid])?.focus();
    return !firstInvalid;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const receipt = await receiptsApi.create({
        payment_received_confirmed: true,
        ...contextPayload(context),
        customer_id: customerMode === "existing" ? customer?.id : undefined,
        customer_name: customerMode === "new" ? customerName : undefined,
        customer_email: customerMode === "new" ? customerEmail || undefined : undefined,
        customer_phone: customerMode === "new" ? customerPhone || undefined : undefined,
        amount_cents: centsFromInput(amount),
        balance_cents: balance ? centsFromInput(balance) : 0,
        reason,
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
        paid_at: paidAt,
      });
      notify(`Receipt ${receipt.reference_number} issued.`, "success");
      navigate(`/receipts/${receipt.id}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not create the receipt.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        back={{ to: "/receipts", label: "Receipts" }}
        title="New receipt"
        subtitle="Record a payment already received locally and issue a formal receipt."
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="stack">
          <Card>
            <CardHeader
              title="Payer"
              action={
                <SegmentedControl
                  label="Payer type"
                  value={customerMode}
                  onChange={setCustomerMode}
                  options={[
                    { value: "existing", label: "Existing payer" },
                    { value: "new", label: "New payer" },
                  ]}
                />
              }
            />

            {customerMode === "existing" ? (
              <Field label="Payer" htmlFor="customer_id" required error={errors.customerId}>
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
            ) : (
              <div className="form-grid">
                <Field label="Payer name" htmlFor="customer_name" required error={errors.customerName} className="form-grid-full">
                  <Input id="customer_name" autoComplete="off" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="customer_email" error={errors.customerContact} hint="Email or phone is required, so the receipt can be delivered.">
                  <Input id="customer_email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </Field>
                <Field label="Phone" htmlFor="customer_phone" hint="International format, e.g. +256701234567">
                  <Input id="customer_phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </Field>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Property" description="Link the payment to a property or tenancy, if it relates to one." />
            <PropertyContextPicker customer={customerMode === "existing" ? customer : null} value={context} onChange={setContext} />
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="form-grid">
              <Field label="Amount received" htmlFor="amount" required error={errors.amount}>
                {currency ? (
                  <PrefixedInput
                    prefix={currency}
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                ) : (
                  <Input id="amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                )}
              </Field>
              <Field label="Outstanding balance" htmlFor="balance" hint="Leave blank if fully settled; it prints as “Nil”.">
                <Input id="balance" type="number" inputMode="decimal" min="0" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
              </Field>
              <Field label="Date paid" htmlFor="paid_at" required error={errors.paidAt}>
                <Input id="paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </Field>
              <Field label="Payment method" htmlFor="payment_method" required>
                <Select id="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}>
                  {PAYMENT_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference number" htmlFor="payment_reference" hint="Bank slip number, mobile money transaction ID or cheque number." className="form-grid-full">
                <Input id="payment_reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              </Field>
              <Field label="Reason for payment" htmlFor="reason" required error={errors.reason} hint="State it in full, e.g. “Rent for July 2026”." className="form-grid-full">
                <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>

            <div className="stack" style={{ marginTop: "var(--space-5)" }}>
              <label className="checkbox-row">
                <input
                  id="payment_confirmed"
                  type="checkbox"
                  checked={confirmed}
                  aria-invalid={errors.confirmed ? true : undefined}
                  aria-describedby={errors.confirmed ? "payment_confirmed-error" : undefined}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I confirm this payment has already been received
                  <small>A receipt is proof of money received. This app doesn't collect or move payments.</small>
                </span>
              </label>
              {errors.confirmed && (
                <p className="field-error" id="payment_confirmed-error" role="alert">
                  {errors.confirmed}
                </p>
              )}
            </div>

            <div className="action-bar">
              <ButtonLink to="/receipts" variant="ghost">
                Cancel
              </ButtonLink>
              <Button type="submit" isLoading={isSubmitting}>
                Issue receipt
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
