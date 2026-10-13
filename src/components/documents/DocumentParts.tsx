import { useRef, useState, type FormEvent } from "react";
import { Ban, Mail, MessageSquare, RotateCcw } from "lucide-react";
import { invoicesApi } from "../../api/documents";
import { ApiError } from "../../lib/apiClient";
import type { InvoiceDetail, NotificationEvent, PaymentRecorded } from "../../lib/documentTypes";
import { centsFromInput, formatDateTime, formatMoney, todayISO } from "../../lib/format";
import { PAYMENT_METHOD_LABELS, type DeliveryChannel, type PaymentMethodType } from "../../lib/types";
import { Alert, Button, Field, Input, PrefixedInput, Select } from "../ui/ui";
import { Modal } from "../ui/Modal";
import { NotificationStatusBadge } from "../ui/StatusBadge";

/* ---------- Send / resend ---------- */

export function SendDialog({
  title,
  description,
  onSend,
  onClose,
}: {
  title: string;
  description: string;
  onSend: (channels: DeliveryChannel[]) => Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const channels: DeliveryChannel[] = [...(email ? (["email"] as const) : []), ...(sms ? (["sms"] as const) : [])];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSend(channels);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <form onSubmit={submit}>
        <fieldset className="channel-picker">
          <legend className="sr-only">Delivery channels</legend>
          <label className="checkbox-row">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            <span>
              <Mail size={15} aria-hidden /> Email, with the PDF attached
            </span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
            <span>
              <MessageSquare size={15} aria-hidden /> SMS, with a link to view it
            </span>
          </label>
        </fieldset>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={channels.length === 0}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Record a payment ---------- */

export function RecordPaymentModal({
  invoice,
  onRecorded,
  onClose,
}: {
  invoice: InvoiceDetail;
  onRecorded: (result: PaymentRecorded) => void;
  onClose: () => void;
}) {
  // One key per opened dialog: a double-click or a retry after a timeout reaches the server
  // with the same key, so the payment (and its receipt) is created only once.
  const idempotencyKey = useRef(crypto.randomUUID());
  const [amount, setAmount] = useState((invoice.outstanding_cents / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethodType>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cents = centsFromInput(amount);
  const remaining = invoice.outstanding_cents - cents;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (cents <= 0) return setError("Enter an amount greater than zero.");
    if (cents > invoice.outstanding_cents) {
      return setError(`The amount can't exceed the outstanding balance of ${formatMoney(invoice.outstanding_cents, invoice.currency)}.`);
    }
    setBusy(true);
    try {
      const result = await invoicesApi.recordPayment(
        invoice.id,
        { amount_cents: cents, paid_at: paidAt, payment_method: method, payment_reference: reference.trim() || undefined },
        idempotencyKey.current,
      );
      onRecorded(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record a payment"
      description={`Record money you've already received for invoice ${invoice.number}. A receipt is issued automatically.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className="stack">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="payment-summary">
            <span>Outstanding balance</span>
            <strong>{formatMoney(invoice.outstanding_cents, invoice.currency)}</strong>
          </div>
          <Field label="Amount received" htmlFor="pay_amount" required>
            <PrefixedInput
              prefix={invoice.currency}
              id="pay_amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          {cents > 0 && cents <= invoice.outstanding_cents && (
            <p className="muted-text" aria-live="polite">
              {remaining === 0
                ? "This clears the invoice. It will be marked as paid."
                : `Balance after this payment: ${formatMoney(remaining, invoice.currency)}`}
            </p>
          )}
          <div className="form-grid">
            <Field label="Date received" htmlFor="pay_date" required>
              <Input id="pay_date" type="date" max={todayISO()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Payment method" htmlFor="pay_method" required>
              <Select id="pay_method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodType)}>
                {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethodType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference" htmlFor="pay_ref" hint="Bank slip, mobile money transaction ID or cheque number." className="form-grid-full">
              <Input id="pay_ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Record payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Notification / reminder history ---------- */

const KIND_LABELS: Record<string, string> = {
  invoice_issued: "Invoice sent",
  quotation_sent: "Quotation sent",
  reminder_upcoming: "Upcoming payment reminder",
  reminder_due: "Due today reminder",
  reminder_overdue: "Overdue follow-up",
  reminder_manual: "Manual reminder",
  payment_recorded: "Payment confirmation",
  schedule_upcoming: "Scheduled payment reminder",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export function NotificationList({
  events,
  onRetry,
  onCancel,
  busyId,
  canAct = true,
}: {
  events: NotificationEvent[];
  onRetry?: (event: NotificationEvent) => void;
  onCancel?: (event: NotificationEvent) => void;
  busyId?: string | null;
  canAct?: boolean;
}) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <div className="timeline-row">
            <span className="timeline-title">
              {e.channel === "email" ? <Mail size={16} aria-label="Email" /> : <MessageSquare size={16} aria-label="SMS" />}
              {kindLabel(e.kind)}
              {e.recipient_party === "business" ? " (to you)" : ""}
            </span>
            <NotificationStatusBadge status={e.status} />
          </div>
          <div className="timeline-meta">
            {e.status === "scheduled" ? "Scheduled for" : e.status === "sent" ? "Sent" : "Planned for"}{" "}
            {formatDateTime(e.sent_at ?? e.scheduled_for)}
            {e.recipient ? ` · ${e.recipient}` : ""}
            {e.attempts > 0 ? ` · ${e.attempts} attempt${e.attempts === 1 ? "" : "s"}` : ""}
          </div>
          {e.skip_reason && <div className="timeline-meta">Reason: {e.skip_reason}</div>}
          {e.status === "failed" && e.attempt_log.at(-1)?.response?.error ? (
            <div className="timeline-meta">Error: {String(e.attempt_log.at(-1)?.response?.error)}</div>
          ) : null}
          {canAct && (e.status === "failed" || e.status === "skipped" || e.status === "scheduled") && (
            <div className="row-actions timeline-actions">
              {onRetry && (e.status === "failed" || e.status === "skipped") && (
                <Button variant="ghost" size="sm" icon={RotateCcw} isLoading={busyId === e.id} onClick={() => onRetry(e)}>
                  Retry
                </Button>
              )}
              {onCancel && (e.status === "scheduled" || e.status === "failed") && (
                <Button variant="ghost" size="sm" icon={Ban} isLoading={busyId === e.id} onClick={() => onCancel(e)}>
                  Stop
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
