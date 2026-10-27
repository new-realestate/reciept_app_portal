import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, CalendarClock, FileQuestion, FileText, MoreHorizontal, Pause, Play, Plus, SkipForward } from "lucide-react";
import { schedulesApi } from "../api/documents";
import { useAccess } from "../auth/AccessContext";
import { ApiError } from "../lib/apiClient";
import type { Frequency, Occurrence, Schedule, ScheduleDetail, SchedulePayload } from "../lib/documentTypes";
import { centsFromInput, formatDay, formatMoney, todayISO } from "../lib/format";
import type { Customer, PropertyContext } from "../lib/types";
import {
  Alert, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, PrefixedInput, SegmentedControl, Select, Spinner,
} from "../components/ui/ui";
import { ConfirmDialog } from "../components/ui/Modal";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { OccurrenceStatusBadge, ScheduleStatusBadge } from "../components/ui/StatusBadge";
import { ReminderPolicyEditor } from "../components/documents/ReminderPolicyEditor";
import { CustomerPicker } from "../components/documents/CustomerPicker";
import { contextPayload, PropertyContextPicker } from "../components/documents/PropertyContextPicker";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";
import { detailQueries } from "../lib/detailQueries";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: "One time",
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every 3 months",
  annually: "Every year",
};

const PAGE_SIZE = 15;

/* ------------------------------------------------------------------ list */

export function SchedulesPage() {
  useDocumentTitle("Payment schedules");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [status, setStatus] = useState("");

  const { data, isLoading, error, reload: load } = useApiQuery(
    qk.schedules({ status, limit, offset }),
    () => schedulesApi.list({ status: status || undefined, limit, offset }),
    { fallbackError: "Could not load schedules.", keepPrevious: true },
  );
  const items: Schedule[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: Column<Schedule>[] = [
    {
      key: "desc",
      header: "Schedule",
      cell: (s) => (
        <Link to={`/schedules/${s.id}`} className="table-link">
          {s.description}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", cell: (s) => s.customer_name ?? "—" },
    { key: "amount", header: "Amount", align: "end", cell: (s) => formatMoney(s.amount_cents, s.currency) },
    { key: "freq", header: "Repeats", cell: (s) => FREQUENCY_LABELS[s.frequency] },
    { key: "next", header: "Next payment", cell: (s) => (s.next_due_date ? formatDay(s.next_due_date) : "—") },
    { key: "status", header: "Status", cell: (s) => <ScheduleStatusBadge status={s.status} /> },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (s) => (
        <DropdownMenu label={`Actions for ${s.description}`} triggerClassName="icon-btn" items={[{ label: "View details", icon: FileText, to: `/schedules/${s.id}` }]}>
          <MoreHorizontal size={18} aria-hidden />
          <span className="sr-only">Actions for {s.description}</span>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payment schedules"
        subtitle="Expected payments such as rent or service fees. Each one drives reminders and the upcoming-payments view; invoices are created only when you ask."
        actions={<ButtonLink to="/schedules/new" icon={Plus}>New schedule</ButtonLink>}
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter schedules">
          <Field label="Status" htmlFor="sch_status">
            <Select id="sch_status" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Payment schedules"
          columns={columns}
          rows={items}
          rowKey={(s) => s.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="schedules"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            <EmptyState
              icon={CalendarClock}
              title={status ? "No schedules with this status" : "No payment schedules yet"}
              description="Create a schedule for monthly rent or a recurring service so you always know what is due next."
              action={<ButtonLink to="/schedules/new" icon={Plus}>Create a schedule</ButtonLink>}
            />
          }
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ create */

export function NewSchedulePage() {
  useDocumentTitle("New payment schedule");
  const navigate = useNavigate();
  const { notify } = useToast();
  const currency = useAccess().business?.default_currency ?? "UGX";
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [context, setContext] = useState<PropertyContext>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [firstDue, setFirstDue] = useState(todayISO(7));
  const [endDate, setEndDate] = useState("");
  const [maxOcc, setMaxOcc] = useState("");
  const [reminders, setReminders] = useState(true);
  const [autoInvoice, setAutoInvoice] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (mode === "existing" && !customer) next.customer = "Choose a customer.";
    if (mode === "new") {
      if (!name.trim()) next.name = "Customer name is required.";
      if (!email.trim() && !phone.trim()) next.contact = "Provide an email or phone number.";
    }
    if (!description.trim()) next.description = "Describe what the payment is for.";
    if (centsFromInput(amount) <= 0) next.amount = "Enter an amount greater than zero.";
    if (!firstDue) next.firstDue = "Choose the first due date.";
    if (frequency !== "once" && endDate && endDate < firstDue) next.endDate = "The end date can't be before the first due date.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById({ customer: "sch_customer", name: "sch_name", contact: "sch_email", description: "sch_desc", amount: "sch_amount", firstDue: "sch_first", endDate: "sch_end" }[first] ?? "")?.focus();
    return !first;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: SchedulePayload = {
        ...contextPayload(context),
        ...(mode === "existing" ? { customer_id: customer?.id } : { customer_name: name.trim(), customer_email: email.trim() || undefined, customer_phone: phone.trim() || undefined }),
        description: description.trim(),
        reference_label: reference.trim() || undefined,
        amount_cents: centsFromInput(amount),
        currency,
        frequency,
        first_due_date: firstDue,
        end_date: frequency !== "once" && endDate ? endDate : undefined,
        max_occurrences: frequency !== "once" && maxOcc ? Number(maxOcc) : undefined,
        reminders_enabled: reminders,
        auto_invoice: autoInvoice,
      };
      const created = await schedulesApi.create(payload);
      notify("Payment schedule created.", "success");
      navigate(`/schedules/${created.id}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not create the schedule.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader back={{ to: "/schedules", label: "Schedules" }} title="New payment schedule" subtitle="Track a payment you expect, once or on a repeating basis." />
      <form onSubmit={submit} noValidate>
        <div className="stack">
          <Card>
            <CardHeader
              title="Customer"
              action={<SegmentedControl label="Customer type" value={mode} onChange={setMode} options={[{ value: "existing", label: "Existing customer" }, { value: "new", label: "New customer" }]} />}
            />
            {mode === "existing" ? (
              <Field label="Customer" htmlFor="sch_customer" required error={errors.customer}>
                <CustomerPicker id="sch_customer" value={customer} invalid={Boolean(errors.customer)} onChange={(c) => { setCustomer(c); setContext({}); }} />
              </Field>
            ) : (
              <div className="form-grid">
                <Field label="Customer name" htmlFor="sch_name" required error={errors.name} className="form-grid-full"><Input id="sch_name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="Email" htmlFor="sch_email" error={errors.contact}><Input id="sch_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Phone" htmlFor="sch_phone"><Input id="sch_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Property" description="Optional: link the schedule to a property or tenancy, e.g. for rent." />
            <PropertyContextPicker customer={mode === "existing" ? customer : null} value={context} onChange={setContext} />
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="form-grid">
              <Field label="What is it for?" htmlFor="sch_desc" required error={errors.description} hint="e.g. “Monthly rent, Plot 12”" className="form-grid-full">
                <Input id="sch_desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
              </Field>
              <Field label="Reference (optional)" htmlFor="sch_ref" hint="A property, tenancy or agreement this relates to." className="form-grid-full">
                <Input id="sch_ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} />
              </Field>
              <Field label="Expected amount" htmlFor="sch_amount" required error={errors.amount}>
                <PrefixedInput prefix={currency} id="sch_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Repeats" htmlFor="sch_freq">
                <Select id="sch_freq" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                  {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label={frequency === "once" ? "Due date" : "First due date"} htmlFor="sch_first" required error={errors.firstDue} hint={frequency === "monthly" ? "A 31st stays on the last day of shorter months, then returns to the 31st." : undefined}>
                <Input id="sch_first" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </Field>
              {frequency !== "once" && (
                <>
                  <Field label="End date (optional)" htmlFor="sch_end" error={errors.endDate}><Input id="sch_end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
                  <Field label="Number of payments (optional)" htmlFor="sch_max" hint="Leave both blank to repeat until you cancel."><Input id="sch_max" type="number" min="1" max="600" value={maxOcc} onChange={(e) => setMaxOcc(e.target.value)} /></Field>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Reminders and invoices" />
            <div className="stack">
              <label className="checkbox-row">
                <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
                <span>Send payment reminders<small>Uses your business reminder settings. You can adjust them for this schedule afterwards.</small></span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={autoInvoice} onChange={(e) => setAutoInvoice(e.target.checked)} />
                <span>
                  Automatically issue and send an invoice a week before each due date
                  <small>Off by default. When off, each due payment is only an expectation, and you create an invoice yourself when you want one. Either way, one invoice per due date at most.</small>
                </span>
              </label>
            </div>
            <div className="action-bar">
              <ButtonLink to="/schedules" variant="ghost">Cancel</ButtonLink>
              <Button type="submit" isLoading={busy}>Create schedule</Button>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

export function ScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const scheduleDef = detailQueries.schedule(scheduleId ?? "");
  const scheduleQuery = useApiQuery(scheduleDef.queryKey, scheduleDef.queryFn, {
    fallbackError: "Could not load the schedule.",
    enabled: Boolean(scheduleId),
  });
  const schedule: ScheduleDetail | null = scheduleQuery.data ?? null;
  const error = scheduleQuery.error ? { message: scheduleQuery.error, notFound: scheduleQuery.errorStatus === 404 } : null;
  const [confirm, setConfirm] = useState<null | "cancel" | { skip: Occurrence } | { invoice: Occurrence }>(null);
  const [busy, setBusy] = useState(false);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState("");

  useDocumentTitle(schedule ? schedule.description : "Payment schedule");

  const load = scheduleQuery.reload;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      notify(success, "success");
      setConfirm(null);
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Payment schedule" back={{ to: "/schedules", label: "Schedules" }} />
        <Card>
          {error.notFound ? <EmptyState icon={FileQuestion} title="Schedule not found" /> : <ErrorState message={error.message} onRetry={load} />}
        </Card>
      </>
    );
  }
  if (!schedule) return <div className="full-page-center"><Spinner label="Loading schedule…" /></div>;

  const active = schedule.status === "active";
  const closed = schedule.status === "cancelled" || schedule.status === "completed";

  const occColumns: Column<Occurrence>[] = [
    { key: "due", header: "Due date", cell: (o) => formatDay(o.due_date) },
    {
      key: "when",
      header: "",
      cell: (o) =>
        o.status === "expected" ? (
          <span className={o.days_until_due < 0 ? "cell-note cell-note--danger" : "cell-note"}>
            {o.days_until_due === 0 ? "Due today" : o.days_until_due > 0 ? `in ${o.days_until_due} days` : `${-o.days_until_due} days overdue`}
          </span>
        ) : null,
    },
    { key: "amount", header: "Expected", align: "end", cell: (o) => formatMoney(o.amount_cents, schedule.currency) },
    { key: "paid", header: "Paid", align: "end", cell: (o) => (o.amount_paid_cents ? formatMoney(o.amount_paid_cents, schedule.currency) : "—") },
    { key: "invoice", header: "Invoice", cell: (o) => (o.invoice_id ? <Link className="table-link" to={`/invoices/${o.invoice_id}`}>{o.invoice_number ?? "Draft"}</Link> : "—") },
    { key: "status", header: "Status", cell: (o) => <OccurrenceStatusBadge status={o.status} /> },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (o) =>
        o.status === "expected" && active ? (
          <DropdownMenu
            label={`Actions for the ${formatDay(o.due_date)} payment`}
            triggerClassName="icon-btn"
            items={[
              { label: "Create invoice", icon: FileText, onSelect: () => setConfirm({ invoice: o }) },
              { label: "Skip this payment", icon: SkipForward, onSelect: () => setConfirm({ skip: o }) },
            ]}
          >
            <MoreHorizontal size={18} aria-hidden />
            <span className="sr-only">Actions for the {formatDay(o.due_date)} payment</span>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        back={{ to: "/schedules", label: "Schedules" }}
        title={schedule.description}
        subtitle={`${schedule.customer_name ?? "Customer"} · ${formatMoney(schedule.amount_cents, schedule.currency)} · ${FREQUENCY_LABELS[schedule.frequency]}`}
        actions={
          <>
            {active && <Button variant="secondary" icon={Pause} isLoading={busy} onClick={() => run(() => schedulesApi.pause(schedule.id), "Schedule paused. Reminders are on hold.")}>Pause</Button>}
            {schedule.status === "paused" && <Button icon={Play} isLoading={busy} onClick={() => run(() => schedulesApi.resume(schedule.id), "Schedule resumed.")}>Resume</Button>}
            {!closed && <Button variant="danger" icon={Ban} onClick={() => setConfirm("cancel")}>Cancel schedule</Button>}
          </>
        }
      />

      {schedule.status === "paused" && <Alert tone="warning">This schedule is paused. No reminders are sent and no new payments are expected until you resume it.</Alert>}
      {schedule.auto_invoice ? (
        <Alert tone="info">Invoices are issued and sent automatically about a week before each due date.</Alert>
      ) : (
        <Alert tone="info">Each due payment is an expectation with reminders. Nothing is invoiced until you choose “Create invoice” for it.</Alert>
      )}

      <div className="page-grid page-grid--wide-left">
        <Card flush>
          <div className="card-pad"><CardHeader title="Payments" description="Past and upcoming due dates for this schedule." /></div>
          <DataTable caption="Scheduled payments" columns={occColumns} rows={schedule.occurrences} rowKey={(o) => o.id} pageSize={12} itemLabel="payments"
            empty={<EmptyState icon={CalendarClock} title="No payments generated" description="Resume the schedule to generate upcoming payments." />} />
        </Card>

        <div className="stack">
          <Card>
            <CardHeader title="Details" action={<ScheduleStatusBadge status={schedule.status} />} />
            <dl className="definition-list">
              <div>
                <dt>Amount</dt>
                <dd>
                  {editingAmount ? (
                    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await schedulesApi.update(schedule.id, { amount_cents: centsFromInput(amountInput) }); setEditingAmount(false); }, "Amount updated for upcoming payments."); }}>
                      <PrefixedInput prefix={schedule.currency} aria-label="New amount" inputMode="decimal" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
                      <Button type="submit" size="sm" isLoading={busy}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingAmount(false)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      {formatMoney(schedule.amount_cents, schedule.currency)}{" "}
                      {!closed && <Button size="sm" variant="ghost" onClick={() => { setAmountInput((schedule.amount_cents / 100).toFixed(2)); setEditingAmount(true); }}>Change</Button>}
                    </>
                  )}
                </dd>
              </div>
              <div><dt>First due</dt><dd>{formatDay(schedule.first_due_date)}</dd></div>
              {schedule.end_date && <div><dt>Ends</dt><dd>{formatDay(schedule.end_date)}</dd></div>}
              {schedule.max_occurrences && <div><dt>Number of payments</dt><dd>{schedule.max_occurrences}</dd></div>}
              {schedule.reference_label && <div><dt>Reference</dt><dd>{schedule.reference_label}</dd></div>}
            </dl>
            {editingAmount && <p className="muted-text">Only upcoming payments without an invoice change. Invoices already issued keep their amount.</p>}
          </Card>

          {!closed && (
            <Card>
              <CardHeader title="Reminders" description="Who is reminded, and when, relative to each due date." />
              <ReminderPolicyEditor
                enabled={schedule.reminders_enabled}
                overrides={schedule.reminder_overrides}
                onSave={async (body) => {
                  await schedulesApi.updateReminders(schedule.id, body);
                  await load();
                }}
              />
            </Card>
          )}
        </div>
      </div>

      {confirm === "cancel" && (
        <ConfirmDialog title="Cancel this schedule?" description="Upcoming payments are dropped and reminders stop. Invoices and receipts that already exist are kept." confirmLabel="Cancel schedule" tone="danger" isLoading={busy} onCancel={() => setConfirm(null)} onConfirm={() => run(() => schedulesApi.cancel(schedule.id), "Schedule cancelled.")} />
      )}
      {confirm && typeof confirm === "object" && "skip" in confirm && (
        <ConfirmDialog title="Skip this payment?" description={`The ${formatDay(confirm.skip.due_date)} payment will no longer be expected and its reminders stop.`} confirmLabel="Skip payment" isLoading={busy} onCancel={() => setConfirm(null)} onConfirm={() => run(() => schedulesApi.skip(confirm.skip.id), "Payment skipped.")} />
      )}
      {confirm && typeof confirm === "object" && "invoice" in confirm && (
        <ConfirmDialog
          title="Create an invoice for this payment?"
          description={`Issues an invoice for ${formatMoney(confirm.invoice.amount_cents, schedule.currency)} due ${formatDay(confirm.invoice.due_date)}. You can then send it and record the payment when it arrives.`}
          confirmLabel="Create invoice"
          isLoading={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              const inv = await schedulesApi.createInvoice(confirm.invoice.id, { issue_now: true });
              notify("Invoice created.", "success");
              navigate(`/invoices/${inv.id}`);
            } catch (err) {
              notify(err instanceof ApiError ? err.message : "Could not create the invoice.", "error");
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

