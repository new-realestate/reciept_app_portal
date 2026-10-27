import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, Download, ExternalLink, FileQuestion, Mail, MessageCircle, MessageSquare, MoreHorizontal, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { receiptsApi } from "../api/receipts";
import { ApiError } from "../lib/apiClient";
import { formatDateTime, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type DeliveryChannel, type ReceiptDetail } from "../lib/types";
import {
  ButtonAnchor,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui/ui";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { DeliveryStatusBadge, ReceiptStatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * WhatsApp click-to-chat link with the receipt message prefilled; the user taps Send in WhatsApp.
 * Without a usable phone number WhatsApp asks which chat to share to.
 */
function whatsAppShareUrl(receipt: ReceiptDetail, hostedUrl: string): string {
  const business = receipt.business_name ? `${receipt.business_name}: ` : "";
  const text = `${business}Payment of ${formatMoney(receipt.amount_cents, receipt.currency)} received. View your receipt: ${hostedUrl}`;
  // wa.me wants the international number as digits only; local numbers ("07…") are Ugandan, like the API's default.
  let digits = (receipt.customer_phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `256${digits.slice(1)}`;
  return `https://wa.me/${digits.length >= 8 ? digits : ""}?text=${encodeURIComponent(text)}`;
}

export function ReceiptDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const { notify } = useToast();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [isSending, setIsSending] = useState(false);

  useDocumentTitle(receipt ? `Receipt ${receipt.reference_number}` : "Receipt");

  const load = useCallback(async () => {
    if (!receiptId) return;
    setIsLoading(true);
    setError(null);
    try {
      setReceipt(await receiptsApi.get(receiptId));
    } catch (err) {
      const notFound = err instanceof ApiError && err.status === 404;
      setError({ message: err instanceof ApiError ? err.message : "Could not load the receipt.", notFound });
    } finally {
      setIsLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend(channels: DeliveryChannel[], isResend: boolean) {
    if (!receiptId) return;
    setIsSending(true);
    try {
      const action = isResend ? receiptsApi.resend : receiptsApi.send;
      await action(receiptId, { channels, email_mode: "attachment" });
      notify(`Receipt ${isResend ? "resent" : "sent"} via ${channels.join(" & ")}.`, "success");
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Delivery failed.", "error");
    } finally {
      setIsSending(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      notify("Receipt link copied.", "success");
    } catch {
      notify("Could not copy the link. Open the hosted receipt and copy it from the address bar.", "error");
    }
  }

  if (isLoading && !receipt) {
    return (
      <div className="full-page-center">
        <Spinner label="Loading receipt…" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <>
        <PageHeader title="Receipt" back={{ to: "/receipts", label: "Receipts" }} />
        <Card>
          {error?.notFound ? (
            <EmptyState
              icon={FileQuestion}
              title="Receipt not found"
              description="It may have been removed, or the link is incorrect."
            />
          ) : (
            <ErrorState message={error?.message ?? "Could not load the receipt."} onRetry={load} />
          )}
        </Card>
      </>
    );
  }

  const hasBeenSent = receipt.delivery_attempts.length > 0;
  const hostedUrl = receiptsApi.hostedViewUrl(receipt.hosted_view_token);
  const verb = hasBeenSent ? "Resend" : "Send";

  return (
    <div>
      <PageHeader
        back={{ to: "/receipts", label: "Receipts" }}
        title={`Receipt ${receipt.reference_number}`}
        subtitle={`Issued by ${receipt.issuer_printed_name} on ${formatDateTime(receipt.created_at)}`}
        actions={
          <>
            <DropdownMenu
              label="Delivery options"
              triggerClassName="btn btn--primary"
              disabled={isSending}
              items={[
                { label: `${verb} by email`, icon: Mail, onSelect: () => handleSend(["email"], hasBeenSent) },
                { label: `${verb} by SMS`, icon: MessageSquare, onSelect: () => handleSend(["sms"], hasBeenSent) },
                {
                  label: `${verb} by email and SMS`,
                  icon: Send,
                  onSelect: () => handleSend(["email", "sms"], hasBeenSent),
                },
                {
                  label: receipt.customer_phone ? `Share on WhatsApp with ${receipt.customer_name ?? "customer"}` : "Share on WhatsApp",
                  icon: MessageCircle,
                  href: whatsAppShareUrl(receipt, hostedUrl),
                  separatorBefore: true,
                },
              ]}
            >
              {isSending ? <span className="btn-spinner" aria-hidden /> : <Send size={16} aria-hidden />}
              {isSending ? "Sending…" : `${verb} receipt`}
              <ChevronDown size={16} aria-hidden />
            </DropdownMenu>

            {receipt.pdf_url && (
              <ButtonAnchor href={receipt.pdf_url} target="_blank" rel="noreferrer" icon={Download}>
                Download PDF
              </ButtonAnchor>
            )}

            <DropdownMenu
              label="More actions"
              triggerClassName="icon-btn"
              items={[
                { label: "Open hosted receipt", icon: ExternalLink, href: hostedUrl },
                { label: "Copy receipt link", icon: Copy, onSelect: () => copyLink(hostedUrl) },
              ]}
            >
              <MoreHorizontal size={18} aria-hidden />
              <span className="sr-only">More actions</span>
            </DropdownMenu>
          </>
        }
      />

      <div className="page-grid page-grid--wide-left">
        <Card>
          <CardHeader title="Payment" action={<ReceiptStatusBadge status={receipt.status} />} />
          <p className="amount-hero">{formatMoney(receipt.amount_cents, receipt.currency)}</p>
          <p className="muted-text" style={{ marginBottom: "var(--space-6)" }}>
            {receipt.amount_in_words}
          </p>
          <dl className="definition-list">
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
            <div>
              <dt>Balance</dt>
              <dd>{receipt.balance_cents === 0 ? "Nil" : formatMoney(receipt.balance_cents, receipt.currency)}</dd>
            </div>
            {receipt.property_id && (
              <div>
                <dt>Property</dt>
                <dd>
                  <Link className="table-link" to={`/properties/${receipt.property_id}`}>
                    View property
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Delivery history"
            description={hasBeenSent ? undefined : "This receipt hasn't been sent to the payer yet."}
          />
          {isLoading ? (
            <div className="stack">
              <Skeleton width="70%" />
              <Skeleton width="45%" />
            </div>
          ) : hasBeenSent ? (
            <ol className="timeline">
              {receipt.delivery_attempts.map((a) => (
                <li key={a.id}>
                  <div className="timeline-row">
                    <span className="timeline-title">
                      {a.channel === "email" ? (
                        <Mail size={16} aria-label="Email" />
                      ) : (
                        <MessageSquare size={16} aria-label="SMS" />
                      )}
                      {a.recipient}
                    </span>
                    <DeliveryStatusBadge status={a.status} />
                  </div>
                  <div className="timeline-meta">
                    Attempt {a.attempt_number} · {formatDateTime(a.attempted_at)}
                    {a.provider ? ` · via ${a.provider}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
