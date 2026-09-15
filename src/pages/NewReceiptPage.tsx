import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { receiptsApi } from "../api/receipts";
import { customersApi } from "../api/customers";
import { ApiError } from "../lib/apiClient";
import { centsFromInput } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type Customer, type PaymentMethodType } from "../lib/types";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethodType, string][];

export function NewReceiptPage() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [customerId, setCustomerId] = useState("");
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
    customersApi.list().then(setCustomers).catch(() => undefined);
  }, []);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (customerMode === "existing" && !customerId) next.customerId = "Choose a customer.";
    if (customerMode === "new") {
      if (!customerName.trim()) next.customerName = "Payer name is required.";
      if (!customerEmail.trim() && !customerPhone.trim()) next.customerContact = "Provide an email or phone number.";
    }
    if (!amount || centsFromInput(amount) <= 0) next.amount = "Enter an amount greater than zero.";
    if (!reason.trim()) next.reason = "Describe the reason for payment.";
    if (!paidAt) next.paidAt = "Select the date paid.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const receipt = await receiptsApi.create({
        customer_id: customerMode === "existing" ? customerId : undefined,
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
      <PageHeader title="New receipt" subtitle="Record a payment already received locally and issue a formal receipt." />

      <form onSubmit={handleSubmit}>
        <Card className="form-card">
          <h2 className="section-title">Payer</h2>
          <div className="segmented">
            <button type="button" className={customerMode === "new" ? "segmented-active" : ""} onClick={() => setCustomerMode("new")}>
              New payer
            </button>
            <button type="button" className={customerMode === "existing" ? "segmented-active" : ""} onClick={() => setCustomerMode("existing")}>
              Existing payer
            </button>
          </div>

          {customerMode === "existing" ? (
            <Field label="Select payer" htmlFor="customer_id" required error={errors.customerId}>
              <Select id="customer_id" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Choose a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="form-grid">
              <Field label="Payer name" htmlFor="customer_name" required error={errors.customerName}>
                <Input id="customer_name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </Field>
              <Field label="Email" htmlFor="customer_email" error={errors.customerContact}>
                <Input id="customer_email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="customer_phone" hint="E.164 format, e.g. +256701234567">
                <Input id="customer_phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </Field>
            </div>
          )}
        </Card>

        <Card className="form-card">
          <h2 className="section-title">Payment</h2>
          <div className="form-grid">
            <Field label="Amount received" htmlFor="amount" required error={errors.amount} hint="In the tenant's default currency, e.g. 1500000">
              <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Outstanding balance" htmlFor="balance" hint="Leave blank if fully settled (renders as 'Nil').">
              <Input id="balance" type="number" min="0" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
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
            <Field label="Reference number" htmlFor="payment_reference" hint="Bank slip #, mobile money transaction ID, or cheque #.">
              <Input id="payment_reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </Field>
          </div>
          <Field label="Reason for payment" htmlFor="reason" required error={errors.reason} hint="Stated in full, e.g. 'Rent for the month of July 2026'.">
            <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Card>

        <div className="form-actions">
          <Button type="submit" isLoading={isSubmitting}>
            Issue receipt
          </Button>
        </div>
      </form>
    </div>
  );
}
