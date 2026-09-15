import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { receiptsApi } from "../api/receipts";
import { ApiError } from "../lib/apiClient";
import { formatDateTime, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type DeliveryChannel, type ReceiptDetail } from "../lib/types";
import { Badge, Button, Card, PageHeader, Spinner } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

const DELIVERY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  delivered: "success",
  sent: "success",
  opened: "success",
  queued: "neutral",
  bounced: "danger",
  failed: "danger",
};

export function ReceiptDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const { notify } = useToast();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingChannel, setSendingChannel] = useState<DeliveryChannel | "both" | null>(null);

  const load = useCallback(async () => {
    if (!receiptId) return;
    setIsLoading(true);
    try {
      const data = await receiptsApi.get(receiptId);
      setReceipt(data);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not load the receipt.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [receiptId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend(channels: DeliveryChannel[], key: DeliveryChannel | "both", isResend: boolean) {
    if (!receiptId) return;
    setSendingChannel(key);
    try {
      const action = isResend ? receiptsApi.resend : receiptsApi.send;
      await action(receiptId, { channels, email_mode: "attachment" });
      notify(`Receipt ${isResend ? "resent" : "sent"} via ${channels.join(" & ")}.`, "success");
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Delivery failed.", "error");
    } finally {
      setSendingChannel(null);
    }
  }

  if (isLoading) {
    return (
      <div className="full-page-center">
        <Spinner label="Loading receipt…" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <Card>
        <p>Receipt not found.</p>
        <Link to="/receipts">Back to receipts</Link>
      </Card>
    );
  }

  const hasBeenSent = receipt.delivery_attempts.length > 0;
  const hostedUrl = receiptsApi.hostedViewUrl(receipt.hosted_view_token);

  return (
    <div>
      <PageHeader
        title={`Receipt ${receipt.reference_number}`}
        subtitle={`Issued by ${receipt.issuer_printed_name} on ${formatDateTime(receipt.created_at)}`}
        actions={
          <div className="row-actions">
            <a className="btn btn--secondary" href={hostedUrl} target="_blank" rel="noreferrer">
              View hosted receipt
            </a>
            {receipt.pdf_url && (
              <a className="btn btn--secondary" href={receipt.pdf_url} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            )}
          </div>
        }
      />

      <div className="detail-grid">
        <Card>
          <h2 className="section-title">Summary</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <Badge tone={receipt.status === "issued" ? "success" : "warning"}>{receipt.status}</Badge>
              </dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>{formatMoney(receipt.amount_cents, receipt.currency)}</dd>
            </div>
            <div>
              <dt>In words</dt>
              <dd>{receipt.amount_in_words}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{receipt.balance_cents === 0 ? "Nil" : formatMoney(receipt.balance_cents, receipt.currency)}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{receipt.reason}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>
                {PAYMENT_METHOD_LABELS[receipt.payment_method]}
                {receipt.payment_reference ? ` · Ref: ${receipt.payment_reference}` : ""}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="section-title">Send / resend</h2>
          <p className="muted-text">Deliver this receipt to the payer by email, SMS, or both.</p>
          <div className="row-actions">
            <Button variant="secondary" isLoading={sendingChannel === "email"} onClick={() => handleSend(["email"], "email", hasBeenSent)}>
              {hasBeenSent ? "Resend" : "Send"} email
            </Button>
            <Button variant="secondary" isLoading={sendingChannel === "sms"} onClick={() => handleSend(["sms"], "sms", hasBeenSent)}>
              {hasBeenSent ? "Resend" : "Send"} SMS
            </Button>
            <Button isLoading={sendingChannel === "both"} onClick={() => handleSend(["email", "sms"], "both", hasBeenSent)}>
              {hasBeenSent ? "Resend" : "Send"} both
            </Button>
          </div>

          <h3 className="subsection-title">Delivery history</h3>
          {receipt.delivery_attempts.length === 0 ? (
            <p className="muted-text">No delivery attempts yet.</p>
          ) : (
            <ul className="delivery-list">
              {receipt.delivery_attempts.map((a) => (
                <li key={a.id}>
                  <div className="delivery-row">
                    <span className="delivery-channel">{a.channel === "email" ? "✉️" : "📱"} {a.recipient}</span>
                    <Badge tone={DELIVERY_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                  </div>
                  <div className="delivery-meta">
                    Attempt #{a.attempt_number} · {formatDateTime(a.attempted_at)}
                    {a.provider ? ` · via ${a.provider}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
