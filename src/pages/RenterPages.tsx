import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarX, Home, Plus, ReceiptText, Search, SearchX } from "lucide-react";
import { customersApi } from "../api/customers";
import { kycApi } from "../api/kyc";
import { propertiesApi } from "../api/properties";
import { rentersApi } from "../api/renters";
import { tenantApi } from "../api/tenant";
import { useAccess } from "../auth/AccessContext";
import { ApiError } from "../lib/apiClient";
import { centsFromInput, formatDate, formatMoney, todayISO } from "../lib/format";
import {
  RENT_FREQUENCY_LABELS,
  type Property,
  type RentFrequency,
  type Renter,
  type RenterDetail,
  type Tenancy,
  type TenancyPayload,
  type Unit,
} from "../lib/propertyTypes";
import type { Customer, CustomerDocuments } from "../lib/types";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
} from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { KycStatusBadge, RenterStatusBadge, TenancyStatusBadge } from "../components/ui/StatusBadge";
import { CustomerPicker } from "../components/documents/CustomerPicker";
import { KycPanel } from "../components/kyc/KycPanel";
import { NoAccess } from "../components/RequirePerm";
import { DocumentHistory } from "./CustomerDetailPage";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

function tenancyPlace(t: Tenancy) {
  return [t.property_name, t.unit_label].filter(Boolean).join(", ");
}

const COLUMNS: Column<Renter>[] = [
  {
    key: "name",
    header: "Tenant",
    cell: (r) => (
      <Link className="table-link" to={`/tenants/${r.id}`}>
        {r.customer.name}
      </Link>
    ),
  },
  { key: "contact", header: "Contact", cell: (r) => r.customer.phone ?? r.customer.email ?? "—" },
  {
    key: "where",
    header: "Current tenancy",
    cell: (r) => (r.current_tenancies.length ? r.current_tenancies.map(tenancyPlace).join("; ") : "—"),
  },
  { key: "status", header: "Status", cell: (r) => <RenterStatusBadge status={r.status} /> },
  { key: "kyc", header: "KYC", cell: (r) => <KycStatusBadge status={r.kyc_status} /> },
];

/* ------------------------------------------------------------------ list */

export function RentersPage() {
  useDocumentTitle("Tenants");
  const [rows, setRows] = useState<Renter[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [status, setStatus] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    propertiesApi.list().then(setProperties).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await rentersApi.listPage(
        { q: activeQuery || undefined, status: status || undefined, property_id: propertyId || undefined },
        PAGE_SIZE,
        offset,
      );
      if (id === requestId.current) {
        setRows(page.items);
        setTotal(page.total);
      }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load tenants.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [activeQuery, status, propertyId, offset]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setActiveQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = Boolean(activeQuery || status || propertyId);

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle="People and businesses renting your properties. Every tenant is also a customer."
        actions={
          <ButtonLink to="/tenants/new" icon={Plus}>
            Add tenant
          </ButtonLink>
        }
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter tenants">
          <Field label="Search" htmlFor="ten_q" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input id="ten_q" type="search" placeholder="Name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </Field>
          <Field label="Property" htmlFor="ten_prop">
            <Select id="ten_prop" value={propertyId} onChange={(e) => { setOffset(0); setPropertyId(e.target.value); }}>
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="ten_status">
            <Select id="ten_status" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
              <option value="">Any</option>
              <option value="active">Current</option>
              <option value="former">Former</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Tenants"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="tenants"
          serverPaging={{ total, offset, limit: PAGE_SIZE, onOffsetChange: setOffset }}
          empty={
            filtered ? (
              <EmptyState icon={SearchX} title="No tenants match these filters" />
            ) : (
              <EmptyState
                icon={Home}
                title="No tenants yet"
                description="Add a tenant to record their tenancy, KYC and rent."
                action={<ButtonLink to="/tenants/new" icon={Plus}>Add tenant</ButtonLink>}
              />
            )
          }
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ tenancy fields */

interface TenancyDraft {
  propertyId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  rent: string;
  frequency: RentFrequency;
  deposit: string;
  status: "active" | "draft";
  notes: string;
  createSchedule: boolean;
}

function emptyTenancy(propertyId = ""): TenancyDraft {
  return {
    propertyId, unitId: "", startDate: todayISO(), endDate: "", rent: "", frequency: "monthly", deposit: "",
    status: "active", notes: "", createSchedule: false,
  };
}

function validateTenancy(t: TenancyDraft): Record<string, string> {
  const next: Record<string, string> = {};
  if (!t.propertyId) next.ten_property = "Choose a property.";
  if (!t.startDate) next.ten_start = "Choose the start date.";
  if (t.endDate && t.endDate < t.startDate) next.ten_end = "The end date can't be before the start date.";
  if (t.rent === "" || centsFromInput(t.rent) < 0) next.ten_rent = "Enter the agreed rent.";
  return next;
}

function tenancyPayload(t: TenancyDraft, currency: string): TenancyPayload {
  return {
    property_id: t.propertyId,
    unit_id: t.unitId || null,
    start_date: t.startDate,
    end_date: t.endDate || null,
    rent_amount_cents: centsFromInput(t.rent),
    currency,
    rent_frequency: t.frequency,
    deposit_cents: t.deposit ? centsFromInput(t.deposit) : 0,
    status: t.status,
    notes: t.notes.trim() || undefined,
    create_rent_schedule: t.createSchedule,
  };
}

function TenancyFields({
  value,
  onChange,
  errors,
  currency,
}: {
  value: TenancyDraft;
  onChange: (next: TenancyDraft) => void;
  errors: Record<string, string>;
  currency: string;
}) {
  const { can } = useAccess();
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    propertiesApi.list({ status: "active" }).then(setProperties).catch(() => setProperties([]));
  }, []);

  useEffect(() => {
    setUnits([]);
    if (!value.propertyId) return;
    propertiesApi.get(value.propertyId).then((p) => setUnits(p.units.filter((u) => u.status === "active"))).catch(() => setUnits([]));
  }, [value.propertyId]);

  const set = (patch: Partial<TenancyDraft>) => onChange({ ...value, ...patch });

  if (properties === null) return <Spinner label="Loading properties…" />;
  if (properties.length === 0) {
    return <Alert tone="warning">There are no active properties you can add tenancies to. Ask your business owner to assign you one.</Alert>;
  }

  return (
    <div className="form-grid">
      <Field label="Property" htmlFor="ten_property" required error={errors.ten_property}>
        <Select id="ten_property" value={value.propertyId} onChange={(e) => set({ propertyId: e.target.value, unitId: "" })}>
          <option value="">Choose a property…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unit" htmlFor="ten_unit" hint={value.propertyId && units.length === 0 ? "This property has no units." : "Occupied units are marked."}>
        <Select
          id="ten_unit"
          value={value.unitId}
          disabled={units.length === 0}
          onChange={(e) => {
            const unit = units.find((u) => u.id === e.target.value);
            set({ unitId: e.target.value, rent: !value.rent && unit?.default_rent_cents ? String(unit.default_rent_cents / 100) : value.rent });
          }}
        >
          <option value="">Whole property</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
              {u.occupied ? " (occupied)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Start date" htmlFor="ten_start" required error={errors.ten_start}>
        <Input id="ten_start" type="date" value={value.startDate} onChange={(e) => set({ startDate: e.target.value })} />
      </Field>
      <Field label="End date (optional)" htmlFor="ten_end" error={errors.ten_end}>
        <Input id="ten_end" type="date" value={value.endDate} onChange={(e) => set({ endDate: e.target.value })} />
      </Field>
      <Field label={`Agreed rent (${currency})`} htmlFor="ten_rent" required error={errors.ten_rent}>
        <Input id="ten_rent" type="number" inputMode="decimal" min="0" step="0.01" value={value.rent} onChange={(e) => set({ rent: e.target.value })} />
      </Field>
      <Field label="Paid" htmlFor="ten_freq">
        <Select id="ten_freq" value={value.frequency} onChange={(e) => set({ frequency: e.target.value as RentFrequency })}>
          {(Object.entries(RENT_FREQUENCY_LABELS) as [RentFrequency, string][]).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`Security deposit (${currency})`} htmlFor="ten_deposit">
        <Input id="ten_deposit" type="number" inputMode="decimal" min="0" step="0.01" value={value.deposit} onChange={(e) => set({ deposit: e.target.value })} />
      </Field>
      <Field label="Status" htmlFor="ten_status_sel" hint="Use draft while the agreement isn't final.">
        <Select id="ten_status_sel" value={value.status} onChange={(e) => set({ status: e.target.value as "active" | "draft" })}>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </Select>
      </Field>
      <Field label="Notes" htmlFor="ten_notes" className="form-grid-full">
        <Textarea id="ten_notes" rows={2} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      {can("invoices.issue") && (
        <label className="checkbox-row form-grid-full">
          <input type="checkbox" checked={value.createSchedule} onChange={(e) => set({ createSchedule: e.target.checked })} />
          <span>
            Track the rent with a payment schedule
            <small>Creates expected payments and reminders from the start date. You still issue receipts only when rent is received.</small>
          </span>
        </label>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ create */

interface Match {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export function NewRenterPage() {
  useDocumentTitle("Add tenant");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isManager } = useAccess();
  const { notify } = useToast();
  const [currency, setCurrency] = useState("UGX");
  const [mode, setMode] = useState<"existing" | "new">(params.get("customer") ? "existing" : "new");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"individual" | "business">("individual");
  const [occupation, setOccupation] = useState("");
  const [employer, setEmployer] = useState("");
  const [notes, setNotes] = useState("");
  const [withTenancy, setWithTenancy] = useState(true);
  const [tenancy, setTenancy] = useState<TenancyDraft>(() => emptyTenancy(params.get("property") ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tenantApi.getMine().then((t) => setCurrency(t.default_currency)).catch(() => undefined);
    const customerId = params.get("customer");
    if (customerId) customersApi.get(customerId).then(setCustomer).catch(() => undefined);
  }, [params]);

  const tenancyRequired = !isManager;
  const includeTenancy = tenancyRequired || withTenancy;

  async function submit(e: FormEvent | null, allowDuplicate = false) {
    e?.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (mode === "existing" && !customer) next.ten_customer = "Choose a customer.";
    if (mode === "existing" && customer?.renter_id) next.ten_customer = "This customer already has a tenant profile.";
    if (mode === "new") {
      if (!name.trim()) next.ten_name = "Name is required.";
      if (!email.trim() && !phone.trim()) next.ten_email = "Provide an email or phone number.";
    }
    if (includeTenancy) Object.assign(next, validateTenancy(tenancy));
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) return document.getElementById(first)?.focus();

    setBusy(true);
    try {
      const renter = await rentersApi.create({
        ...(mode === "existing"
          ? { customer_id: customer!.id }
          : { customer: { name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, customer_type: customerType } }),
        allow_duplicate_customer: allowDuplicate || undefined,
        occupation: occupation.trim() || undefined,
        employer: employer.trim() || undefined,
        notes: notes.trim() || undefined,
        tenancy: includeTenancy ? tenancyPayload(tenancy, currency) : undefined,
      });
      notify(`${renter.customer.name} added as a tenant.`, "success");
      navigate(`/tenants/${renter.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.data?.matches)) {
        setMatches(err.data.matches as Match[]);
      } else if (err instanceof ApiError && err.status === 409 && typeof err.data?.renter_id === "string") {
        setFormError(err.message);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not add the tenant.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickMatch(id: string) {
    setMatches(null);
    try {
      setCustomer(await customersApi.get(id));
      setMode("existing");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not load that customer.");
    }
  }

  return (
    <div>
      <PageHeader back={{ to: "/tenants", label: "Tenants" }} title="Add tenant" subtitle="Creates the customer (or reuses one), the tenant profile and the tenancy together." />
      <form onSubmit={(e) => submit(e)} noValidate>
        <div className="stack">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Card>
            <CardHeader
              title="Who is renting?"
              action={
                <SegmentedControl
                  label="Customer"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "new", label: "New customer" },
                    { value: "existing", label: "Existing customer" },
                  ]}
                />
              }
            />
            {mode === "existing" ? (
              <div className="stack">
                <Field label="Customer" htmlFor="ten_customer" required error={errors.ten_customer} hint="Their contact details and past documents stay as they are.">
                  <CustomerPicker id="ten_customer" value={customer} onChange={setCustomer} invalid={Boolean(errors.ten_customer)} />
                </Field>
                {customer?.renter_id && (
                  <Alert tone="info">
                    {customer.name} is already a tenant. <Link to={`/tenants/${customer.renter_id}`}>Open their profile</Link> to add another tenancy.
                  </Alert>
                )}
              </div>
            ) : (
              <div className="form-grid">
                <Field label="Name" htmlFor="ten_name" required error={errors.ten_name} className="form-grid-full">
                  <Input id="ten_name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="ten_email" error={errors.ten_email} hint="Email or phone is required.">
                  <Input id="ten_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Phone" htmlFor="ten_phone">
                  <Input id="ten_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Type" htmlFor="ten_ctype">
                  <Select id="ten_ctype" value={customerType} onChange={(e) => setCustomerType(e.target.value as "individual" | "business")}>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </Select>
                </Field>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Tenant details" />
            <div className="form-grid">
              <Field label="Occupation" htmlFor="ten_occ">
                <Input id="ten_occ" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </Field>
              <Field label="Employer" htmlFor="ten_emp">
                <Input id="ten_emp" value={employer} onChange={(e) => setEmployer(e.target.value)} />
              </Field>
              <Field label="Notes" htmlFor="ten_rnotes" className="form-grid-full" hint="Internal; not shown on documents.">
                <Textarea id="ten_rnotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <p className="muted-text">You can add identity (KYC) details and documents on the tenant's page after saving.</p>
          </Card>

          <Card>
            <CardHeader title="Tenancy" description={tenancyRequired ? "Required: on one of the properties assigned to you." : undefined} />
            {!tenancyRequired && (
              <label className="checkbox-row" style={{ marginBottom: "var(--space-4)" }}>
                <input type="checkbox" checked={withTenancy} onChange={(e) => setWithTenancy(e.target.checked)} />
                <span>Add their tenancy now</span>
              </label>
            )}
            {includeTenancy && <TenancyFields value={tenancy} onChange={setTenancy} errors={errors} currency={currency} />}
            <div className="action-bar">
              <ButtonLink to="/tenants" variant="ghost">
                Cancel
              </ButtonLink>
              <Button type="submit" isLoading={busy}>
                Add tenant
              </Button>
            </div>
          </Card>
        </div>
      </form>

      {matches && (
        <Modal title="This customer may already exist" description="A customer with the same email or phone number is already on file." onClose={() => setMatches(null)}>
          <div className="stack">
            <ul className="match-list">
              {matches.map((m) => (
                <li key={m.id}>
                  <span>
                    <strong>{m.name}</strong>
                    <span className="muted-text"> {[m.email, m.phone].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Button size="sm" onClick={() => pickMatch(m.id)}>
                    Use this customer
                  </Button>
                </li>
              ))}
            </ul>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setMatches(null)}>
                Go back
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMatches(null);
                  submit(null, true);
                }}
              >
                They're a different person — create new
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

export function RenterDetailPage() {
  const { renterId = "" } = useParams();
  const { isManager, can } = useAccess();
  const { notify } = useToast();
  const [renter, setRenter] = useState<RenterDetail | null>(null);
  const [docs, setDocs] = useState<CustomerDocuments | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [addingTenancy, setAddingTenancy] = useState(false);
  const [ending, setEnding] = useState<Tenancy | null>(null);
  const [editing, setEditing] = useState(false);
  useDocumentTitle(renter?.customer.name ?? "Tenant");

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await rentersApi.get(renterId);
      setRenter(r);
      if (can("customers.view")) customersApi.documents(r.customer_id).then(setDocs).catch(() => setDocs(null));
    } catch (err) {
      setError(err instanceof ApiError ? { message: err.message, status: err.status } : { message: "Could not load the tenant.", status: 0 });
    }
  }, [renterId, can]);

  useEffect(() => {
    load();
  }, [load]);

  const loadKyc = useCallback(() => kycApi.forRenter(renterId), [renterId]);

  if (error?.status === 404) return <NoAccess message="This tenant doesn't exist or isn't on a property assigned to you." />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!renter) return <Spinner label="Loading tenant…" />;

  const c = renter.customer;

  return (
    <div>
      <PageHeader
        back={{ to: "/tenants", label: "Tenants" }}
        title={c.name}
        subtitle={[c.phone, c.email].filter(Boolean).join(" · ")}
        actions={
          <>
            <RenterStatusBadge status={renter.status} />
            <KycStatusBadge status={renter.kyc_status} />
            {can("receipts.issue") && (
              <ButtonLink to={`/receipts/new?customer=${c.id}`} icon={ReceiptText} variant="secondary">
                Issue receipt
              </ButtonLink>
            )}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        }
      />

      <div className="page-grid page-grid--wide-left">
        <div className="stack">
          <Card>
            <CardHeader
              title="Tenancies"
              description="Current and past. Ending a tenancy keeps its record and documents."
              action={
                renter.status !== "archived" && (
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddingTenancy(true)}>
                    New tenancy
                  </Button>
                )
              }
            />
            {renter.tenancies.length === 0 ? (
              <EmptyState icon={Home} title="No tenancies yet" />
            ) : (
              <ul className="member-list">
                {renter.tenancies.map((t) => (
                  <li key={t.id}>
                    <span>
                      <strong>{tenancyPlace(t)}</strong>
                      <span className="muted-text">
                        {" "}
                        · {t.reference} · {formatDate(t.start_date)}
                        {t.end_date ? ` – ${formatDate(t.end_date)}` : " onwards"} · {formatMoney(t.rent_amount_cents, t.currency)}{" "}
                        {RENT_FREQUENCY_LABELS[t.rent_frequency].toLowerCase()}
                        {t.deposit_cents ? ` · deposit ${formatMoney(t.deposit_cents, t.currency)}` : ""}
                      </span>
                      {t.payment_schedule_id && (
                        <>
                          {" "}
                          <Link className="table-link" to={`/schedules/${t.payment_schedule_id}`}>
                            Rent schedule
                          </Link>
                        </>
                      )}
                    </span>
                    <span className="badge-row">
                      <TenancyStatusBadge status={t.status} />
                      {(t.status === "active" || t.status === "draft") && (
                        <Button size="sm" variant="ghost" icon={CalendarX} onClick={() => setEnding(t)}>
                          End
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <KycPanel load={loadKyc} />

          {docs && <DocumentHistory docs={docs} />}
        </div>

        <Card>
          <CardHeader
            title="Customer details"
            action={
              can("customers.view") && (
                <ButtonLink size="sm" variant="ghost" to={`/customers/${c.id}`}>
                  Open customer
                </ButtonLink>
              )
            }
          />
          <dl className="definition-list">
            <div>
              <dt>Phone</dt>
              <dd>{c.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{c.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Occupation</dt>
              <dd>{[renter.occupation, renter.employer].filter(Boolean).join(" at ") || "—"}</dd>
            </div>
            {renter.notes && (
              <div>
                <dt>Notes</dt>
                <dd className="pre-wrap">{renter.notes}</dd>
              </div>
            )}
            <div>
              <dt>Tenant since</dt>
              <dd>{formatDate(renter.created_at)}</dd>
            </div>
          </dl>
          <p className="muted-text">Contact details are shared with the customer record, so they're edited there.</p>
        </Card>
      </div>

      {addingTenancy && (
        <AddTenancyModal
          renter={renter}
          onClose={() => setAddingTenancy(false)}
          onSaved={() => {
            setAddingTenancy(false);
            notify("Tenancy added.", "success");
            load();
          }}
        />
      )}
      {ending && (
        <EndTenancyModal
          tenancy={ending}
          onClose={() => setEnding(null)}
          onSaved={() => {
            setEnding(null);
            notify("Tenancy ended.", "success");
            load();
          }}
        />
      )}
      {editing && (
        <EditRenterModal
          renter={renter}
          canArchive={isManager}
          onClose={() => setEditing(false)}
          onSaved={(r) => {
            setRenter(r);
            setEditing(false);
            notify("Tenant updated.", "success");
          }}
        />
      )}
    </div>
  );
}

function AddTenancyModal({ renter, onClose, onSaved }: { renter: RenterDetail; onClose: () => void; onSaved: () => void }) {
  const [currency, setCurrency] = useState("UGX");
  const [tenancy, setTenancy] = useState<TenancyDraft>(() => emptyTenancy());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tenantApi.getMine().then((t) => setCurrency(t.default_currency)).catch(() => undefined);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validateTenancy(tenancy);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await rentersApi.addTenancy(renter.id, tenancyPayload(tenancy, currency));
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add the tenancy.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`New tenancy for ${renter.customer.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <TenancyFields value={tenancy} onChange={setTenancy} errors={errors} currency={currency} />
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Add tenancy
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EndTenancyModal({ tenancy, onClose, onSaved }: { tenancy: Tenancy; onClose: () => void; onSaved: () => void }) {
  const [endDate, setEndDate] = useState(todayISO());
  const [kind, setKind] = useState<"ended" | "terminated">("ended");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (endDate < tenancy.start_date) return setFormError("The end date can't be before the tenancy started.");
    setBusy(true);
    try {
      await rentersApi.endTenancy(tenancy.id, { end_date: endDate, status: kind, reason: reason.trim() || undefined });
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not end the tenancy.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`End tenancy ${tenancy.reference}?`}
      description="The unit becomes vacant and rent schedules stop at the end date. Receipts and history are kept."
      onClose={onClose}
    >
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="End date" htmlFor="end_date" required>
          <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="How did it end?" htmlFor="end_kind">
          <Select id="end_kind" value={kind} onChange={(e) => setKind(e.target.value as "ended" | "terminated")}>
            <option value="ended">Ended as agreed</option>
            <option value="terminated">Terminated early</option>
          </Select>
        </Field>
        <Field label="Reason (optional)" htmlFor="end_reason">
          <Textarea id="end_reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={busy}>
            End tenancy
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditRenterModal({
  renter,
  canArchive,
  onClose,
  onSaved,
}: {
  renter: RenterDetail;
  canArchive: boolean;
  onClose: () => void;
  onSaved: (r: RenterDetail) => void;
}) {
  const [occupation, setOccupation] = useState(renter.occupation ?? "");
  const [employer, setEmployer] = useState(renter.employer ?? "");
  const [notes, setNotes] = useState(renter.notes ?? "");
  const [archived, setArchived] = useState(renter.status === "archived");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(
        await rentersApi.update(renter.id, {
          occupation: occupation.trim() || null,
          employer: employer.trim() || null,
          notes: notes.trim() || null,
          ...(canArchive && archived !== (renter.status === "archived")
            ? { status: archived ? "archived" : renter.current_tenancies.length ? "active" : "former" }
            : {}),
        }),
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit tenant" onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Occupation" htmlFor="er_occ">
          <Input id="er_occ" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
        </Field>
        <Field label="Employer" htmlFor="er_emp">
          <Input id="er_emp" value={employer} onChange={(e) => setEmployer(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="er_notes">
          <Textarea id="er_notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {canArchive && (
          <label className="checkbox-row">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            <span>
              Archive this tenant
              <small>Hides them from current lists. Their tenancies and documents are kept.</small>
            </span>
          </label>
        )}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
