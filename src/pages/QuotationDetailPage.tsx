import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Copy, Download, ExternalLink, FileQuestion, FileText, MoreHorizontal, Pencil, RefreshCw, Send } from "lucide-react";
import { notificationsApi, quotationsApi } from "../api/documents";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import type { NotificationEvent, Quotation } from "../lib/documentTypes";
import { formatDateTime, formatDay, formatMoney, todayISO } from "../lib/format";
import type { DeliveryChannel } from "../lib/types";
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Spinner, Textarea } from "../components/ui/ui";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { DropdownMenu, type MenuItem } from "../components/ui/DropdownMenu";
import { QuotationStatusBadge } from "../components/ui/StatusBadge";
import { NotificationList, SendDialog, copyToClipboard } from "../components/documents/DocumentParts";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Dialog = null | "send" | "cancel" | "convert";

export function QuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { notify } = useToast();
  const [q, setQ] = useState<Quotation | null>(null);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [busyEvent, setBusyEvent] = useState<string | null>(null);
  const canManage = session ? permissions.canManageDocuments(session.role) : false;

  useDocumentTitle(q ? `Quotation ${q.number ?? "draft"}` : "Quotation");

  const load = useCallback(async () => {
    if (!quotationId) return;
    try {
      const [quote, ev] = await Promise.all([quotationsApi.get(quotationId), quotationsApi.notifications(quotationId)]);
      setQ(quote);
      setEvents(ev);
      setError(null);
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : "Could not load the quotation.", notFound: err instanceof ApiError && err.status === 404 });
    }
  }, [quotationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendTo(channels: DeliveryChannel[]) {
    if (!q) return;
    try {
      await quotationsApi.send(q.id, channels);
      notify("Quotation sent.", "success");
      setDialog(null);
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send.", "error");
    }
  }

  async function cancelQuote() {
    if (!q) return;
    setBusy(true);
    try {
      await quotationsApi.cancel(q.id);
      notify("Quotation cancelled.", "success");
      setDialog(null);
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not cancel.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Quotation" back={{ to: "/quotations", label: "Quotations" }} />
        <Card>
          {error.notFound ? (
            <EmptyState icon={FileQuestion} title="Quotation not found" description="It may belong to another business, or the link is incorrect." />
          ) : (
            <ErrorState message={error.message} onRetry={load} />
          )}
        </Card>
      </>
    );
  }
  if (!q) return <div className="full-page-center"><Spinner label="Loading quotation…" /></div>;

  const isDraft = q.status === "draft";
  const live = q.display_status === "sent" || q.display_status === "viewed";
  const sentBefore = q.status !== "draft";

  const moreItems: MenuItem[] = [
    ...(q.public_url && live
      ? [
          { label: "Open customer page", icon: ExternalLink, href: q.public_url },
          { label: "Copy quotation link", icon: Copy, onSelect: async () => notify((await copyToClipboard(q.public_url!)) ? "Link copied." : "Could not copy the link.", "success") },
        ]
      : []),
    ...(canManage && !isDraft
      ? [{ label: "Create a new link", icon: RefreshCw, onSelect: async () => { try { await quotationsApi.rotateLink(q.id); notify("New link created. Resend the quotation to share it.", "success"); await load(); } catch (e) { notify(e instanceof ApiError ? e.message : "Failed.", "error"); } }, separatorBefore: true }]
      : []),
    ...(canManage && (isDraft || live)
      ? [{ label: "Cancel quotation", icon: Ban, danger: true, onSelect: () => setDialog("cancel"), separatorBefore: true }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        back={{ to: "/quotations", label: "Quotations" }}
        title={q.number ? `Quotation ${q.number}` : "Draft quotation"}
        subtitle={`${q.customer_name ?? "Customer"}${q.title ? ` · ${q.title}` : ""}`}
        actions={
          <>
            {isDraft && <ButtonLink to={`/quotations/${q.id}/edit`} variant="secondary" icon={Pencil}>Edit</ButtonLink>}
            {(isDraft || live) && (
              <Button icon={Send} onClick={() => setDialog("send")}>
                {sentBefore ? "Resend" : "Send"}
              </Button>
            )}
            {q.display_status === "accepted" && !q.converted_invoice_id && (
              <Button icon={FileText} onClick={() => setDialog("convert")}>
                Convert to invoice
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={() => quotationsApi.downloadPdf(q.id, q.number ?? "quotation-draft").catch((e) => notify(e instanceof ApiError ? e.message : "Download failed.", "error"))}>
              PDF
            </Button>
            {moreItems.length > 0 && (
              <DropdownMenu label="More actions" triggerClassName="icon-btn" items={moreItems}>
                <MoreHorizontal size={18} aria-hidden />
                <span className="sr-only">More actions</span>
              </DropdownMenu>
            )}
          </>
        }
      />

      {q.display_status === "expired" && <Alert tone="warning">This quotation expired on {formatDay(q.valid_until)} and can no longer be accepted.</Alert>}
      {q.converted_invoice_id && (
        <Alert tone="success">
          Converted to an invoice. <Link className="table-link" to={`/invoices/${q.converted_invoice_id}`}>Open the invoice</Link>
        </Alert>
      )}

      <div className="page-grid page-grid--wide-left">
        <div className="stack">
          <Card>
            <CardHeader title="Summary" action={<QuotationStatusBadge status={q.display_status} />} />
            <p className="amount-hero">{formatMoney(q.total_cents, q.currency)}</p>
            <dl className="definition-list">
              <div><dt>Issued</dt><dd>{formatDay(q.issue_date)}</dd></div>
              <div><dt>Valid until</dt><dd>{formatDay(q.valid_until)}</dd></div>
              {q.description && <div><dt>Description</dt><dd className="pre-wrap">{q.description}</dd></div>}
              {q.terms && <div><dt>Terms</dt><dd className="pre-wrap">{q.terms}</dd></div>}
              {q.notes && <div><dt>Notes</dt><dd className="pre-wrap">{q.notes}</dd></div>}
              {q.internal_notes && <div><dt>Internal notes</dt><dd className="pre-wrap">{q.internal_notes} <span className="cell-note">(private)</span></dd></div>}
            </dl>
          </Card>

          <Card flush>
            <div className="card-pad"><CardHeader title="Items" /></div>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Quotation line items</caption>
                <thead>
                  <tr><th scope="col">Description</th><th scope="col" className="cell-end">Qty</th><th scope="col" className="cell-end">Unit price</th><th scope="col" className="cell-end">Amount</th></tr>
                </thead>
                <tbody>
                  {q.line_items.map((li) => (
                    <tr key={li.id}>
                      <td data-label="Description">{li.description}{li.tax_rate ? <span className="cell-note"> · {Number(li.tax_rate)}% tax</span> : null}</td>
                      <td data-label="Qty" className="cell-end">{Number(li.quantity)}</td>
                      <td data-label="Unit price" className="cell-end">{formatMoney(li.unit_price_cents, q.currency)}</td>
                      <td data-label="Amount" className="cell-end">{formatMoney(li.line_total_cents, q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="totals-list card-pad">
              <div><dt>Subtotal</dt><dd>{formatMoney(q.subtotal_cents, q.currency)}</dd></div>
              {q.discount_cents > 0 && <div><dt>Discount</dt><dd>- {formatMoney(q.discount_cents, q.currency)}</dd></div>}
              {q.tax_cents > 0 && <div><dt>Tax</dt><dd>{formatMoney(q.tax_cents, q.currency)}</dd></div>}
              <div className="totals-grand"><dt>Total</dt><dd>{formatMoney(q.total_cents, q.currency)}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Customer response" />
            <ol className="timeline">
              <li><div className="timeline-row"><span className="timeline-title">Sent</span><span className="muted-text">{q.sent_at ? formatDateTime(q.sent_at) : "Not sent yet"}</span></div></li>
              <li><div className="timeline-row"><span className="timeline-title">Viewed</span><span className="muted-text">{q.viewed_at ? formatDateTime(q.viewed_at) : "Not yet"}</span></div></li>
              <li>
                <div className="timeline-row">
                  <span className="timeline-title">{q.status === "rejected" ? "Declined" : "Accepted"}</span>
                  <span className="muted-text">{q.responded_at ? formatDateTime(q.responded_at) : "No answer yet"}</span>
                </div>
                {q.accepted_name && <div className="timeline-meta">Confirmed by {q.accepted_name}</div>}
                {q.response_comment && <div className="timeline-meta">“{q.response_comment}”</div>}
              </li>
            </ol>
          </Card>

          <Card>
            <CardHeader title="Delivery history" />
            {events.length === 0 ? (
              <p className="muted-text">Nothing has been sent yet.</p>
            ) : (
              <NotificationList
                events={events}
                busyId={busyEvent}
                onRetry={async (ev) => {
                  setBusyEvent(ev.id);
                  try {
                    const res = await notificationsApi.retry(ev.id);
                    notify(res.status === "sent" ? "Sent." : `Not sent: ${res.skip_reason ?? res.status}`, res.status === "sent" ? "success" : "error");
                    await load();
                  } catch (err) {
                    notify(err instanceof ApiError ? err.message : "Retry failed.", "error");
                  } finally {
                    setBusyEvent(null);
                  }
                }}
              />
            )}
          </Card>
        </div>
      </div>

      {dialog === "send" && (
        <SendDialog
          title={sentBefore ? "Resend quotation" : "Send quotation"}
          description="The customer receives the quotation with a link to view it and accept or decline online."
          onSend={sendTo}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel this quotation?"
          description="The customer will no longer be able to accept it."
          confirmLabel="Cancel quotation"
          tone="danger"
          isLoading={busy}
          onCancel={() => setDialog(null)}
          onConfirm={cancelQuote}
        />
      )}
      {dialog === "convert" && (
        <ConvertDialog
          quotation={q}
          onClose={() => setDialog(null)}
          onConverted={(invoiceId) => {
            notify("Invoice created from the accepted quotation.", "success");
            navigate(`/invoices/${invoiceId}`);
          }}
        />
      )}
    </div>
  );
}

function ConvertDialog({ quotation, onClose, onConverted }: { quotation: Quotation; onClose: () => void; onConverted: (invoiceId: string) => void }) {
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO(14));
  const [instructions, setInstructions] = useState("");
  const [issueNow, setIssueNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (dueDate < issueDate) return setError("The due date can't be before the issue date.");
    setBusy(true);
    try {
      const inv = await quotationsApi.convert(quotation.id, {
        issue_date: issueDate,
        due_date: dueDate,
        payment_instructions: instructions.trim() || undefined,
        issue_now: issueNow,
      });
      onConverted(inv.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not convert the quotation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Convert to invoice"
      description={`Creates an invoice for ${formatMoney(quotation.total_cents, quotation.currency)} with the accepted items and prices. The quotation stays as it was accepted. No payment is recorded.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className="stack">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="form-grid">
            <Field label="Issue date" htmlFor="cv_issue" required><Input id="cv_issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
            <Field label="Payment due date" htmlFor="cv_due" required><Input id="cv_due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="Payment instructions" htmlFor="cv_instr" className="form-grid-full">
              <Textarea id="cv_instr" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} />
            <span>Issue the invoice immediately<small>Otherwise it is saved as a draft you can review first.</small></span>
          </label>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" isLoading={busy}>Create invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
