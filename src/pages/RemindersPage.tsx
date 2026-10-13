import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BellRing, CheckCircle2, FilterX } from "lucide-react";
import { notificationsApi, paymentsApi, schedulesApi } from "../api/documents";
import { customersApi } from "../api/customers";
import { tenantApi } from "../api/tenant";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import type { NotificationEvent, ReminderSettings, Schedule, UpcomingFilters, UpcomingPayment } from "../lib/documentTypes";
import { formatDay, formatMoney } from "../lib/format";
import type { Customer } from "../lib/types";
import { Alert, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, LockedNotice, PageHeader, SegmentedControl, Select, Skeleton } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DueStatusBadge } from "../components/ui/StatusBadge";
import { NotificationList } from "../components/documents/DocumentParts";
import { ReminderPolicyEditor } from "../components/documents/ReminderPolicyEditor";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Tab = "due" | "history" | "settings";
const PAGE_SIZE = 15;

export function dueText(p: Pick<UpcomingPayment, "days_until_due" | "days_overdue" | "status">): string {
  if (p.status === "due_today") return "Due today";
  if (p.status === "overdue") return `${p.days_overdue} day${p.days_overdue === 1 ? "" : "s"} overdue`;
  return `In ${p.days_until_due} day${p.days_until_due === 1 ? "" : "s"}`;
}

export function RemindersPage() {
  useDocumentTitle("Payment reminders");
  const [tab, setTab] = useState<Tab>("due");
  return (
    <div>
      <PageHeader title="Payment reminders" subtitle="What is due next, what is overdue, and every reminder that was scheduled, sent or skipped." />
      <div className="tab-bar">
        <SegmentedControl
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "due", label: "Due and overdue" },
            { value: "history", label: "Reminder history" },
            { value: "settings", label: "Settings" },
          ]}
        />
      </div>
      {tab === "due" && <DueTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function DueTab() {
  const [items, setItems] = useState<UpcomingPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [filters, setFilters] = useState<UpcomingFilters>({ window_days: 30 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    customersApi.list().then(setCustomers).catch(() => undefined);
    schedulesApi.list({ limit: 100 }).then((p) => setSchedules(p.items)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await paymentsApi.upcoming({ ...filters, limit, offset });
      if (id === requestId.current) {
        setItems(page.items);
        setTotal(page.total);
      }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load payments.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [filters, offset, limit]);

  useEffect(() => {
    load();
  }, [load]);

  function setFilter<K extends keyof UpcomingFilters>(key: K, value: UpcomingFilters[K]) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }
  const filtered = Boolean(filters.status || filters.customer_id || filters.schedule_id || filters.date_from || filters.date_to || filters.window_days !== 30);

  const columns: Column<UpcomingPayment>[] = [
    { key: "due", header: "Due date", cell: (p) => formatDay(p.due_date) },
    { key: "when", header: "", cell: (p) => <span className={p.status === "overdue" ? "cell-note cell-note--danger" : "cell-note"}>{dueText(p)}</span> },
    { key: "customer", header: "Customer", cell: (p) => p.customer_name ?? "—" },
    {
      key: "what",
      header: "For",
      cell: (p) =>
        p.invoice_id ? (
          <Link className="table-link" to={`/invoices/${p.invoice_id}`}>{p.invoice_number ?? p.description}</Link>
        ) : p.schedule_id ? (
          <Link className="table-link" to={`/schedules/${p.schedule_id}`}>{p.description}</Link>
        ) : (
          p.description
        ),
    },
    { key: "amount", header: "Amount", align: "end", cell: (p) => formatMoney(p.amount_cents, p.currency) },
    { key: "status", header: "Status", cell: (p) => <DueStatusBadge status={p.status} /> },
  ];

  return (
    <Card flush>
      <div className="filter-bar" role="search" aria-label="Filter payments">
        <Field label="Show" htmlFor="due_status">
          <Select id="due_status" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value || undefined)}>
            <option value="">Overdue and upcoming</option>
            <option value="overdue">Overdue only</option>
            <option value="due_today">Due today</option>
            <option value="upcoming">Upcoming only</option>
          </Select>
        </Field>
        <Field label="Look ahead" htmlFor="due_window">
          <Select id="due_window" value={String(filters.window_days ?? 30)} onChange={(e) => setFilter("window_days", Number(e.target.value))}>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </Select>
        </Field>
        <Field label="Customer" htmlFor="due_customer">
          <Select id="due_customer" value={filters.customer_id ?? ""} onChange={(e) => setFilter("customer_id", e.target.value || undefined)}>
            <option value="">All customers</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Schedule" htmlFor="due_schedule">
          <Select id="due_schedule" value={filters.schedule_id ?? ""} onChange={(e) => setFilter("schedule_id", e.target.value || undefined)}>
            <option value="">All schedules</option>
            {schedules.map((s) => <option key={s.id} value={s.id}>{s.description}</option>)}
          </Select>
        </Field>
        <Field label="Due from" htmlFor="due_from"><Input id="due_from" type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value || undefined)} /></Field>
        <Field label="Due to" htmlFor="due_to"><Input id="due_to" type="date" value={filters.date_to ?? ""} onChange={(e) => setFilter("date_to", e.target.value || undefined)} /></Field>
        {filtered && <Button variant="ghost" icon={FilterX} onClick={() => { setOffset(0); setFilters({ window_days: 30 }); }}>Clear</Button>}
      </div>
      <DataTable
        caption="Due and overdue payments"
        columns={columns}
        rows={items}
        rowKey={(p) => `${p.kind}-${p.id}`}
        isLoading={isLoading}
        error={error}
        onRetry={load}
        itemLabel="payments"
        serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
        empty={<EmptyState icon={CheckCircle2} title={filtered ? "Nothing matches these filters" : "Nothing is due"} description={filtered ? "Try widening the date range or clearing the filters." : "There are no overdue payments and nothing due in this period."} />}
      />
    </Card>
  );
}

function HistoryTab() {
  const { notify } = useToast();
  const [items, setItems] = useState<NotificationEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await notificationsApi.list({ status: status || undefined, limit: PAGE_SIZE, offset });
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the history.");
    } finally {
      setIsLoading(false);
    }
  }, [status, offset]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(ev: NotificationEvent, kind: "retry" | "cancel") {
    setBusyId(ev.id);
    try {
      const res = kind === "retry" ? await notificationsApi.retry(ev.id) : await notificationsApi.cancel(ev.id);
      notify(kind === "cancel" ? "Reminder stopped." : res.status === "sent" ? "Sent." : `Not sent: ${res.skip_reason ?? res.status}`, kind === "retry" && res.status !== "sent" ? "error" : "success");
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "That didn't work.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Everything scheduled, sent, failed or skipped"
        action={
          <Field label="Status" htmlFor="hist_status" className="field--compact">
            <Select id="hist_status" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : isLoading ? (
        <div className="stack"><Skeleton width="70%" /><Skeleton width="50%" /><Skeleton width="60%" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={BellRing} title="No reminders yet" description="Reminders appear here once you issue an invoice or create a payment schedule." />
      ) : (
        <>
          <NotificationList events={items} busyId={busyId} onRetry={(e) => act(e, "retry")} onCancel={(e) => act(e, "cancel")} />
          {total > PAGE_SIZE && (
            <div className="table-footer">
              <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
              <div className="row-actions">
                <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button variant="secondary" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function SettingsTab() {
  const { session } = useAuth();
  const canEdit = session ? permissions.canManageDocuments(session.role) : false;
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    notificationsApi.getSettings().then(setSettings).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load settings."));
  }, []);
  useEffect(load, [load]);

  if (error) return <Card><ErrorState message={error} onRetry={() => { setError(null); load(); }} /></Card>;
  if (!settings) return <Card><div className="stack"><Skeleton width="60%" /><Skeleton width="40%" /></div></Card>;

  return (
    <div className="stack">
      {canEdit && <TimezoneCard timezone={settings.timezone} onSaved={load} />}
    <Card>
      <CardHeader title="Default reminder policy" description={`Applies to every invoice and schedule unless it has its own settings. Times use your business timezone (${settings.timezone}).`} />
      {!canEdit ? (
        <>
          <LockedNotice>Only an Owner or Admin can change these settings.</LockedNotice>
          <p className="muted-text" style={{ marginTop: "var(--space-4)" }}>
            {settings.enabled ? `Reminders go out ${settings.offsets.join(", ")} days from the due date at ${String(settings.send_hour).padStart(2, "0")}:00 by ${settings.channels.join(" and ")}.` : "Automatic reminders are off."}
          </p>
        </>
      ) : (
        <>
          <Alert tone="info">Changing this re-plans reminders that have not been sent yet. Reminders already sent are not affected, and a paid or cancelled invoice is never chased.</Alert>
          <div style={{ marginTop: "var(--space-5)" }}>
            <ReminderPolicyEditor
              enabled={settings.enabled}
              overrides={{ offsets: settings.offsets, channels: settings.channels, send_hour: settings.send_hour }}
              showNotifyBusiness
              notifyBusiness={settings.notify_business}
              idPrefix="biz"
              onSave={async (body) => setSettings(await notificationsApi.updateSettings(body as Partial<ReminderSettings>))}
            />
          </div>
        </>
      )}
    </Card>
    </div>
  );
}

const COMMON_TIMEZONES = [
  "Africa/Kampala", "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Lagos", "Africa/Johannesburg",
  "Africa/Cairo", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "UTC",
];

function TimezoneCard({ timezone, onSaved }: { timezone: string; onSaved: () => void }) {
  const { notify } = useToast();
  const [value, setValue] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await tenantApi.setTimezone(value.trim());
      notify("Timezone saved. Reminders already planned keep their times until reminder settings are saved again.", "success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the timezone.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Business timezone" description="Decides what “today” means for due dates and when reminders are sent." />
      <form onSubmit={save} noValidate>
        <div className="stack">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Timezone" htmlFor="biz_tz" hint="An IANA name, e.g. Africa/Kampala.">
            <Input id="biz_tz" list="tz-list" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <datalist id="tz-list">{COMMON_TIMEZONES.map((z) => <option key={z} value={z} />)}</datalist>
          <div><Button type="submit" isLoading={busy} disabled={value.trim() === timezone}>Save timezone</Button></div>
        </div>
      </form>
    </Card>
  );
}
