import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileText, HandCoins, Hourglass, ReceiptText } from "lucide-react";
import { dashboardApi, paymentsApi } from "../api/documents";
import { ApiError } from "../lib/apiClient";
import type { CurrencyTotals, DashboardSummary, UpcomingPayment } from "../lib/documentTypes";
import { formatDateTime, formatDay, formatMoney } from "../lib/format";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Select, Skeleton, Field, ButtonLink } from "../components/ui/ui";
import { DueStatusBadge } from "../components/ui/StatusBadge";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { activityLabel, entityLink } from "../lib/activity";
import { dueText } from "./RemindersPage";
import type { LucideIcon } from "lucide-react";

const PERIODS = [
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
];

function Stat({ icon: Icon, label, value, note, tone, to }: { icon: LucideIcon; label: string; value: string; note?: string; tone?: "danger" | "success"; to?: string }) {
  const body = (
    <>
      <span className={`stat-icon${tone ? ` stat-icon--${tone}` : ""}`}><Icon size={18} aria-hidden /></span>
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${tone === "danger" ? " amount--danger" : ""}`}>{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </>
  );
  return to ? <Link to={to} className="stat-card stat-card--link">{body}</Link> : <div className="stat-card">{body}</div>;
}

export function DashboardPage() {
  useDocumentTitle("Dashboard");
  const [period, setPeriod] = useState("this_month");
  const [currency, setCurrency] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingPayment[]>([]);
  const [overdue, setOverdue] = useState<UpcomingPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u, o] = await Promise.all([
        dashboardApi.summary(period),
        paymentsApi.upcoming({ status: "upcoming", window_days: 30, limit: 6 }),
        paymentsApi.overdue({ limit: 6 }),
      ]);
      setSummary(s);
      setUpcoming(u.items);
      setOverdue(o.items);
      setCurrency((c) => c ?? s.default_currency);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const currencies = summary ? Object.keys(summary.by_currency) : [];
  const cur = currency && summary?.by_currency[currency] ? currency : summary?.default_currency ?? "";
  const t: CurrencyTotals | undefined = summary?.by_currency[cur];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase() ?? "";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={summary ? `Position as of ${formatDay(summary.as_of)}` : "Invoices, payments and what is due next."}
        actions={
          <div className="dash-controls">
            {currencies.length > 1 && (
              <Field label="Currency" htmlFor="dash_cur" className="field--compact">
                <Select id="dash_cur" value={cur} onChange={(e) => setCurrency(e.target.value)}>
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Period" htmlFor="dash_period" className="field--compact">
              <Select id="dash_period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
          </div>
        }
      />

      {error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : loading && !summary ? (
        <div className="stat-grid">{Array.from({ length: 4 }, (_, i) => <div className="stat-card" key={i}><Skeleton width="60%" /><Skeleton width="80%" /></div>)}</div>
      ) : summary && t ? (
        <div className="stack">
          <section aria-labelledby="dash-period-h">
            <h2 className="section-title" id="dash-period-h">In {periodLabel}</h2>
            <div className="stat-grid stat-grid--two">
              <Stat icon={FileText} label="Total invoiced" value={formatMoney(t.invoiced_cents, cur)} note="Value of invoices issued. Not money received." to="/invoices" />
              <Stat icon={HandCoins} tone="success" label="Payments received" value={formatMoney(t.received_cents, cur)} note={`All receipts issued. ${formatMoney(t.received_on_invoices_cents, cur)} of it was paid against invoices.`} to="/receipts" />
            </div>
          </section>

          <section aria-labelledby="dash-now-h">
            <h2 className="section-title" id="dash-now-h">Right now</h2>
            <div className="stat-grid">
              <Stat icon={Hourglass} label="Outstanding balance" value={formatMoney(t.outstanding_cents, cur)} note="Still owed on issued invoices" to="/invoices?status=unpaid" />
              <Stat icon={AlertTriangle} tone={t.overdue_count ? "danger" : undefined} label="Overdue" value={formatMoney(t.overdue_cents, cur)} note={`${t.overdue_count} ${t.overdue_count === 1 ? "payment" : "payments"} past due`} to="/reminders" />
              <Stat icon={CalendarClock} label="Upcoming (30 days)" value={formatMoney(t.upcoming_30_cents, cur)} note={`${t.upcoming_7_count} due within 7 days · ${t.due_today_count} due today`} to="/reminders" />
              <Stat icon={ClipboardList} label="Pending quotations" value={formatMoney(t.pending_quotations_cents, cur)} note={`${t.pending_quotations_count} awaiting an answer`} to="/quotations" />
            </div>
          </section>

          <div className="page-grid">
            <Card flush>
              <div className="card-pad"><CardHeader title="Overdue" action={<ButtonLink to="/reminders" variant="ghost" size="sm" icon={ArrowRight}>View all</ButtonLink>} /></div>
              <PaymentRows rows={overdue} empty="Nothing is overdue." />
            </Card>
            <Card flush>
              <div className="card-pad"><CardHeader title="Coming up" action={<ButtonLink to="/reminders" variant="ghost" size="sm" icon={ArrowRight}>View all</ButtonLink>} /></div>
              <PaymentRows rows={upcoming} empty="Nothing is due in the next 30 days." />
            </Card>
          </div>

          <div className="page-grid">
            <Card>
              <CardHeader title="Recently received" />
              {summary.recent_payments.length === 0 ? (
                <EmptyState icon={ReceiptText} title="No payments recorded yet" description="Receipts you issue appear here." />
              ) : (
                <ul className="payment-list">
                  {summary.recent_payments.map((p) => (
                    <li key={p.id}>
                      <div>
                        <Link className="table-link" to={`/receipts/${p.id}`}>{p.reference_number}</Link>
                        <span className="muted-text"> · {p.customer_name ?? "—"} · {formatDay(p.paid_at)}</span>
                      </div>
                      <strong>{formatMoney(p.amount_cents, p.currency)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Recent activity" />
              {summary.recent_activity.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No activity yet" />
              ) : (
                <ul className="activity-list">
                  {summary.recent_activity.map((a, i) => {
                    const href = entityLink(a.entity_type, a.entity_id);
                    const label = activityLabel(a.action);
                    return (
                      <li key={`${a.created_at}-${i}`}>
                        {href ? <Link className="table-link" to={href}>{label}</Link> : <span>{label}</span>}
                        <span className="muted-text">{formatDateTime(a.created_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentRows({ rows, empty }: { rows: UpcomingPayment[]; empty: string }) {
  if (rows.length === 0) return <p className="muted-text card-pad">{empty}</p>;
  return (
    <ul className="payment-list payment-list--padded">
      {rows.map((p) => (
        <li key={`${p.kind}-${p.id}`}>
          <div>
            <Link className="table-link" to={p.invoice_id ? `/invoices/${p.invoice_id}` : `/schedules/${p.schedule_id}`}>
              {p.customer_name ?? p.description}
            </Link>
            <span className="muted-text"> · {p.description} · {formatDay(p.due_date)} · {dueText(p)}</span>
          </div>
          <span className="payment-right"><strong>{formatMoney(p.amount_cents, p.currency)}</strong><DueStatusBadge status={p.status} /></span>
        </li>
      ))}
    </ul>
  );
}
