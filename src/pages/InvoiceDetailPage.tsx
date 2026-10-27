import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BellRing,
  Ban,
  Banknote,
  Copy,
  Download,
  ExternalLink,
  FileQuestion,
  Link2Off,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Stamp,
} from "lucide-react";
import { invoicesApi, notificationsApi } from "../api/documents";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import type { InvoiceDetail } from "../lib/documentTypes";
import { formatDay, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type DeliveryChannel, type PaymentMethodType } from "../lib/types";
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui/ui";
import { ConfirmDialog } from "../components/ui/Modal";
import { DropdownMenu, type MenuItem } from "../components/ui/DropdownMenu";
import { InvoiceStatusBadge } from "../components/ui/StatusBadge";
import { NotificationList, RecordPaymentModal, SendDialog, copyToClipboard } from "../components/documents/DocumentParts";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";
import { detailQueries } from "../lib/detailQueries";
import { useQueryClient } from "@tanstack/react-query";

type Dialog = null | "send" | "remind" | "pay" | "cancel" | "revoke" | "rotate" | "issue";

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { session } = useAuth();
  const { notify } = useToast();
  const docQuery = detailQueries.invoice(invoiceId ?? "");
  const query = useApiQuery(
    docQuery.queryKey,
    docQuery.queryFn,
    { fallbackError: "Could not load the invoice.", enabled: Boolean(invoiceId) },
  );
  const invoice = query.data?.doc ?? null;
  const events = query.data?.events ?? [];
  const error = query.error ? { message: query.error, notFound: query.errorStatus === 404 } : null;
  const queryClient = useQueryClient();
  // Show a document returned by an action straight away; the background refetch follows.
  const setInvoice = (doc: InvoiceDetail) =>
    queryClient.setQueryData(qk.invoice(invoiceId ?? ""), (old: { doc: InvoiceDetail; events: typeof events } | undefined) => ({ doc, events: old?.events ?? [] }));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [busyEvent, setBusyEvent] = useState<string | null>(null);

  useDocumentTitle(invoice ? `Invoice ${invoice.number ?? "draft"}` : "Invoice");
  const canManage = session ? permissions.canManageDocuments(session.role) : false;

  const load = query.reload;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      notify(success, "success");
      setDialog(null);
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTo(channels: DeliveryChannel[], reminder: boolean) {
    if (!invoice) return;
    try {
      const results = await (reminder ? invoicesApi.remind(invoice.id, channels) : invoicesApi.send(invoice.id, channels));
      const failed = results.filter((r) => r.status !== "sent");
      if (failed.length === 0) notify(reminder ? "Reminder sent." : "Invoice sent.", "success");
      else notify(failed.map((f) => `${f.channel.toUpperCase()}: ${f.skip_reason ?? f.status}`).join(" · "), "error");
      setDialog(null);
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send.", "error");
    }
  }

  async function copyLink(url: string) {
    notify((await copyToClipboard(url)) ? "Invoice link copied." : "Could not copy. Open the page and copy the address instead.", "success");
  }

  if (error) {
    return (
      <>
        <PageHeader title="Invoice" back={{ to: "/invoices", label: "Invoices" }} />
        <Card>
          {error.notFound ? (
            <EmptyState icon={FileQuestion} title="Invoice not found" description="It may belong to another business, or the link is incorrect." />
          ) : (
            <ErrorState message={error.message} onRetry={load} />
          )}
        </Card>
      </>
    );
  }
  if (!invoice) return <div className="full-page-center"><Spinner label="Loading invoice…" /></div>;

  const isDraft = invoice.status === "draft";
  const isIssued = invoice.status === "issued";
  const open = isIssued && invoice.outstanding_cents > 0;
  const sentBefore = events.some((e) => e.kind === "invoice_issued" && e.status === "sent");

  const moreItems: MenuItem[] = [
    ...(invoice.public_url
      ? [
          { label: "Open customer page", icon: ExternalLink, href: invoice.public_url },
          { label: "Copy invoice link", icon: Copy, onSelect: () => copyLink(invoice.public_url!) },
        ]
      : []),
    ...(open ? [{ label: "Send reminder now", icon: BellRing, onSelect: () => setDialog("remind") }] : []),
    ...(isIssued && invoice.reminders_enabled !== undefined
      ? [{
          label: invoice.reminders_enabled ? "Turn off automatic reminders" : "Turn on automatic reminders",
          icon: BellRing,
          onSelect: () => run(() => invoicesApi.updateReminders(invoice.id, { enabled: !invoice.reminders_enabled }), invoice.reminders_enabled ? "Automatic reminders turned off." : "Automatic reminders turned on."),
          separatorBefore: true,
        }]
      : []),
    ...(canManage && isIssued
      ? [
          { label: "Create a new link", icon: RefreshCw, onSelect: () => setDialog("rotate"), separatorBefore: true },
          ...(invoice.public_url ? [{ label: "Disable the public link", icon: Link2Off, onSelect: () => setDialog("revoke") }] : []),
        ]
      : []),
    ...(canManage && invoice.status !== "cancelled" && invoice.amount_paid_cents === 0
      ? [{ label: "Cancel invoice", icon: Ban, danger: true, onSelect: () => setDialog("cancel"), separatorBefore: true }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        back={{ to: "/invoices", label: "Invoices" }}
        title={invoice.number ? `Invoice ${invoice.number}` : "Draft invoice"}
        subtitle={`${invoice.customer_name ?? "Customer"}${invoice.title ? ` · ${invoice.title}` : ""}`}
        actions={
          <>
            {open && (
              <Button icon={Banknote} onClick={() => setDialog("pay")}>
                Record payment
              </Button>
            )}
            {isDraft && (
              <>
                <ButtonLink to={`/invoices/${invoice.id}/edit`} variant="secondary" icon={Pencil}>Edit</ButtonLink>
                <Button icon={Stamp} onClick={() => setDialog("issue")}>Issue invoice</Button>
              </>
            )}
            {isIssued && (
              <Button variant="secondary" icon={Send} onClick={() => setDialog("send")}>
                {sentBefore ? "Resend" : "Send"}
              </Button>
            )}
            <Button variant="secondary" icon={Download} onClick={() => invoicesApi.downloadPdf(invoice.id, invoice.number ?? "invoice-draft").catch((e) => notify(e instanceof ApiError ? e.message : "Download failed.", "error"))}>
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

      {invoice.status === "cancelled" && (
        <Alert tone="warning">This invoice was cancelled{invoice.cancel_reason ? `: ${invoice.cancel_reason}` : "."} No reminders will be sent.</Alert>
      )}
      {isIssued && !invoice.public_url && (
        <Alert tone="info">The public link is disabled, so customers can't open this invoice online. Create a new link from the More actions menu to share it again.</Alert>
      )}

      <div className="page-grid page-grid--wide-left">
        <div className="stack">
          <Card>
            <CardHeader title="Summary" action={<InvoiceStatusBadge status={invoice.display_status} />} />
            <div className="amount-trio">
              <div>
                <span className="muted-text">Total</span>
                <strong>{formatMoney(invoice.total_cents, invoice.currency)}</strong>
              </div>
              <div>
                <span className="muted-text">Paid</span>
                <strong>{formatMoney(invoice.amount_paid_cents, invoice.currency)}</strong>
              </div>
              <div className={invoice.display_status === "overdue" ? "amount--danger" : undefined}>
                <span className="muted-text">Balance due</span>
                <strong>{isIssued ? formatMoney(invoice.outstanding_cents, invoice.currency) : "—"}</strong>
              </div>
            </div>
            <dl className="definition-list">
              <div><dt>Issued</dt><dd>{formatDay(invoice.issue_date)}</dd></div>
              <div>
                <dt>Due</dt>
                <dd>
                  {formatDay(invoice.due_date)}
                  {invoice.days_overdue > 0 && <span className="cell-note cell-note--danger"> {invoice.days_overdue} days overdue</span>}
                </dd>
              </div>
              {invoice.quotation_id && (
                <div><dt>From quotation</dt><dd><Link className="table-link" to={`/quotations/${invoice.quotation_id}`}>View quotation</Link></dd></div>
              )}
              {invoice.payment_instructions && <div><dt>Payment instructions</dt><dd className="pre-wrap">{invoice.payment_instructions}</dd></div>}
              {invoice.notes && <div><dt>Notes</dt><dd className="pre-wrap">{invoice.notes}</dd></div>}
            </dl>
          </Card>

          <Card flush>
            <div className="card-pad"><CardHeader title="Items" /></div>
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Invoice line items</caption>
                <thead>
                  <tr><th scope="col">Description</th><th scope="col" className="cell-end">Qty</th><th scope="col" className="cell-end">Unit price</th><th scope="col" className="cell-end">Amount</th></tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((li) => (
                    <tr key={li.id}>
                      <td data-label="Description">{li.description}{li.tax_rate ? <span className="cell-note"> · {Number(li.tax_rate)}% tax</span> : null}</td>
                      <td data-label="Qty" className="cell-end">{Number(li.quantity)}</td>
                      <td data-label="Unit price" className="cell-end">{formatMoney(li.unit_price_cents, invoice.currency)}</td>
                      <td data-label="Amount" className="cell-end">{formatMoney(li.line_total_cents, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="totals-list card-pad">
              <div><dt>Subtotal</dt><dd>{formatMoney(invoice.subtotal_cents, invoice.currency)}</dd></div>
              {invoice.discount_cents > 0 && (
                <div><dt>Discount{invoice.discount_percent ? ` (${Number(invoice.discount_percent)}%)` : ""}</dt><dd>- {formatMoney(invoice.discount_cents, invoice.currency)}</dd></div>
              )}
              {invoice.tax_cents > 0 && <div><dt>Tax</dt><dd>{formatMoney(invoice.tax_cents, invoice.currency)}</dd></div>}
              <div className="totals-grand"><dt>Total</dt><dd>{formatMoney(invoice.total_cents, invoice.currency)}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payments received" description="Each payment issues its own receipt." />
            {invoice.payments.length === 0 ? (
              <p className="muted-text">No payments have been recorded for this invoice yet.</p>
            ) : (
              <ul className="payment-list">
                {invoice.payments.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{formatMoney(p.amount_cents, invoice.currency)}</strong>
                      <span className="muted-text">
                        {" "}· {formatDay(p.paid_at)} · {PAYMENT_METHOD_LABELS[p.method as PaymentMethodType] ?? p.method}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                      </span>
                    </div>
                    <Link className="table-link" to={`/receipts/${p.receipt_id}`}>View receipt</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Delivery and reminders"
            description={
              isIssued
                ? invoice.reminders_enabled
                  ? "Automatic reminders are on. They stop when the invoice is paid or cancelled."
                  : "Automatic reminders are off for this invoice."
                : undefined
            }
          />
          {events.length === 0 ? (
            <p className="muted-text">{isDraft ? "Issue the invoice to schedule reminders." : "Nothing has been sent or scheduled yet."}</p>
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
              onCancel={async (ev) => {
                setBusyEvent(ev.id);
                try {
                  await notificationsApi.cancel(ev.id);
                  notify("Reminder stopped.", "success");
                  await load();
                } catch (err) {
                  notify(err instanceof ApiError ? err.message : "Could not stop it.", "error");
                } finally {
                  setBusyEvent(null);
                }
              }}
            />
          )}
        </Card>
      </div>

      {dialog === "send" && (
        <SendDialog
          title={sentBefore ? "Resend invoice" : "Send invoice"}
          description="The customer receives the invoice with a link to view it online."
          onSend={(c) => sendTo(c, false)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "remind" && (
        <SendDialog
          title="Send a payment reminder"
          description={`Reminds ${invoice.customer_name ?? "the customer"} that ${formatMoney(invoice.outstanding_cents, invoice.currency)} is still outstanding. One reminder per channel per hour.`}
          onSend={(c) => sendTo(c, true)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "pay" && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setDialog(null)}
          onRecorded={(r) => {
            setDialog(null);
            notify(r.invoice.display_status === "paid" ? "Payment recorded. The invoice is now paid." : "Payment recorded and receipt issued.", "success");
            setInvoice(r.invoice);
            load();
          }}
        />
      )}
      {dialog === "issue" && (
        <ConfirmDialog
          title="Issue this invoice?"
          description="It gets its number and a public link, and its contents can no longer be edited."
          confirmLabel="Issue invoice"
          isLoading={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => run(() => invoicesApi.issue(invoice.id), "Invoice issued.")}
        />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Cancel this invoice?"
          description="Reminders will stop and payments can no longer be recorded. This can't be undone."
          confirmLabel="Cancel invoice"
          tone="danger"
          isLoading={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => run(() => invoicesApi.cancel(invoice.id), "Invoice cancelled.")}
        />
      )}
      {dialog === "revoke" && (
        <ConfirmDialog
          title="Disable the public link?"
          description="Anyone with the old link will no longer be able to open this invoice. Links already sent stop working."
          confirmLabel="Disable link"
          tone="danger"
          isLoading={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => run(() => invoicesApi.revokeLink(invoice.id), "Public link disabled.")}
        />
      )}
      {dialog === "rotate" && (
        <ConfirmDialog
          title="Create a new link?"
          description="The previous link stops working. You'll need to resend the invoice to give the customer the new one."
          confirmLabel="Create new link"
          isLoading={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => run(() => invoicesApi.rotateLink(invoice.id), "New link created.")}
        />
      )}
    </div>
  );
}
