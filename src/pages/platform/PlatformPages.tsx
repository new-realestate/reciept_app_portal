import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Building2,
  CheckCircle2,
  Eye,
  KeyRound,
  LogIn,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  ScrollText,
  Search,
  SearchX,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  platformApi,
  type AdminBusiness,
  type AdminBusinessDetail,
  type AdminUser,
  type PlatformAuditEntry,
  type PlatformStats,
} from "../../api/platform";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_LABELS } from "../../auth/permissions";
import { ApiError } from "../../lib/apiClient";
import { activityLabel } from "../../lib/activity";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import type { Page } from "../../lib/documentTypes";
import type { UserRole } from "../../lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui/ui";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { DropdownMenu, type MenuItem } from "../../components/ui/DropdownMenu";
import { ConfirmDialog, Modal } from "../../components/ui/Modal";
import { AccountStatusBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Server-paged list state shared by the platform list pages. `fetchPage` must be memoised. */
function usePagedList<T>(fetchPage: (limit: number, offset: number) => Promise<Page<T>>, errorText: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  // The offset belongs to one set of filters (one `fetchPage`); new filters start from the first page.
  const [paged, setPaged] = useState({ fetchPage, offset: 0 });
  const offset = paged.fetchPage === fetchPage ? paged.offset : 0;
  const setOffset = (n: number) => setPaged({ fetchPage, offset: n });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await fetchPage(limit, offset);
      if (id === requestId.current) {
        setRows(page.items);
        setTotal(page.total);
      }
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err, errorText));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [fetchPage, limit, offset, errorText]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    rows,
    isLoading,
    error,
    reload,
    paging: {
      total,
      offset,
      limit,
      onOffsetChange: setOffset,
      onLimitChange: (n: number) => {
        setOffset(0);
        setLimit(n);
      },
    },
  };
}

/** Debounced search text, trimmed. */
function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

function SearchField({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field label="Search" htmlFor={id} className="field--grow">
      <div className="search-input">
        <Search size={16} aria-hidden />
        <Input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function ActionsMenu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu label={label} triggerClassName="icon-btn" items={items}>
      <MoreHorizontal size={18} aria-hidden />
      <span className="sr-only">{label}</span>
    </DropdownMenu>
  );
}

/* ---------- Shared actions ---------- */

function SuspendModal({ title, description, onClose, onConfirm }: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(errorMessage(err, "Could not suspend."));
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Reason" htmlFor="suspend_reason" hint="Optional. Visible to other platform admins and in the business's audit log.">
          <Textarea id="suspend_reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isSubmitting}>
            Suspend
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Suspend / reactivate / act-as for one business, as menu items plus the dialogs they open. */
function useBusinessActions(onChanged: () => void) {
  const { notify } = useToast();
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();
  const [suspending, setSuspending] = useState<{ id: string; business_name: string } | null>(null);
  const [actingAs, setActingAs] = useState<{ id: string; business_name: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function reactivate(b: { id: string; business_name: string }) {
    try {
      await platformApi.reactivateBusiness(b.id);
      notify(`${b.business_name} reactivated.`, "success");
      onChanged();
    } catch (err) {
      notify(errorMessage(err, "Could not reactivate the business."), "error");
    }
  }

  async function actAs() {
    if (!actingAs) return;
    setIsBusy(true);
    try {
      const res = await platformApi.actAsBusiness(actingAs.id);
      startImpersonation(res.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      notify(errorMessage(err, "Could not act as this business."), "error");
      setIsBusy(false);
      setActingAs(null);
    }
  }

  function items(b: { id: string; business_name: string; suspended_at: string | null }, withView: boolean): MenuItem[] {
    return [
      ...(withView ? [{ label: "View details", icon: Eye, to: `/platform/businesses/${b.id}` }] : []),
      { label: "Act as this business", icon: LogIn, onSelect: () => setActingAs(b) },
      b.suspended_at
        ? { label: "Reactivate", icon: PlayCircle, onSelect: () => reactivate(b), separatorBefore: true }
        : { label: "Suspend", icon: PauseCircle, onSelect: () => setSuspending(b), danger: true, separatorBefore: true },
    ];
  }

  const dialogs = (
    <>
      {suspending && (
        <SuspendModal
          title={`Suspend ${suspending.business_name}?`}
          description="Everyone in this business is signed out and can't sign in until you reactivate it. Their data is kept."
          onClose={() => setSuspending(null)}
          onConfirm={async (reason) => {
            await platformApi.suspendBusiness(suspending.id, reason);
            notify(`${suspending.business_name} suspended.`, "success");
            setSuspending(null);
            onChanged();
          }}
        />
      )}
      {actingAs && (
        <ConfirmDialog
          title={`Act as ${actingAs.business_name}?`}
          description="You'll get owner access to this business for up to an hour. Everything you do is recorded in its audit log under your name. Use Exit in the banner to come back."
          confirmLabel="Act as business"
          isLoading={isBusy}
          onConfirm={actAs}
          onCancel={() => setActingAs(null)}
        />
      )}
    </>
  );

  return { items, dialogs };
}

function ChangeRoleModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await platformApi.updateUser(user.id, { role });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Could not change the role."));
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={`Change role for ${user.full_name}`} description={user.business_name ?? undefined} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Role" htmlFor="user_role">
          <Select id="user_role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={role === user.role}>
            Save role
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Row actions for a business user, plus the dialogs they open. */
function useUserActions(onChanged: () => void) {
  const { notify } = useToast();
  const [changingRole, setChangingRole] = useState<AdminUser | null>(null);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string, failure: string) {
    setIsBusy(true);
    try {
      await action();
      notify(success, "success");
      onChanged();
    } catch (err) {
      notify(errorMessage(err, failure), "error");
    } finally {
      setIsBusy(false);
      setResetting(null);
      setDeleting(null);
    }
  }

  function items(u: AdminUser): MenuItem[] {
    if (u.is_superadmin) return [];
    return [
      { label: "Change role", icon: UserCog, onSelect: () => setChangingRole(u) },
      ...(!u.is_verified
        ? [{
            label: "Mark email verified",
            icon: CheckCircle2,
            onSelect: () => run(() => platformApi.updateUser(u.id, { is_verified: true }), `${u.email} marked verified.`, "Could not verify the user."),
          }]
        : []),
      { label: "Send password reset", icon: KeyRound, onSelect: () => setResetting(u) },
      u.suspended_at
        ? {
            label: "Reactivate",
            icon: PlayCircle,
            separatorBefore: true,
            onSelect: () => run(() => platformApi.reactivateUser(u.id), `${u.full_name} reactivated.`, "Could not reactivate the user."),
          }
        : { label: "Suspend", icon: PauseCircle, onSelect: () => setSuspending(u), danger: true, separatorBefore: true },
      { label: "Delete", icon: Trash2, onSelect: () => setDeleting(u), danger: true },
    ];
  }

  const dialogs = (
    <>
      {changingRole && (
        <ChangeRoleModal
          user={changingRole}
          onClose={() => setChangingRole(null)}
          onSaved={() => {
            notify(`${changingRole.full_name}'s role changed.`, "success");
            setChangingRole(null);
            onChanged();
          }}
        />
      )}
      {suspending && (
        <SuspendModal
          title={`Suspend ${suspending.full_name}?`}
          description="They're signed out and can't sign in until you reactivate them."
          onClose={() => setSuspending(null)}
          onConfirm={async (reason) => {
            await platformApi.suspendUser(suspending.id, reason);
            notify(`${suspending.full_name} suspended.`, "success");
            setSuspending(null);
            onChanged();
          }}
        />
      )}
      {resetting && (
        <ConfirmDialog
          title="Send a password reset email?"
          description={`${resetting.email} will get a link to choose a new password. It expires in an hour.`}
          confirmLabel="Send email"
          isLoading={isBusy}
          onConfirm={() => run(() => platformApi.sendPasswordReset(resetting.id), `Password reset sent to ${resetting.email}.`, "Could not send the email.")}
          onCancel={() => setResetting(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.full_name}?`}
          description="This permanently removes their account. Users who have issued receipts can't be deleted; suspend them instead."
          confirmLabel="Delete user"
          tone="danger"
          isLoading={isBusy}
          onConfirm={() => run(() => platformApi.deleteUser(deleting.id), `${deleting.full_name} deleted.`, "Could not delete the user.")}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );

  return { items, dialogs };
}

function userColumns(actions: (u: AdminUser) => MenuItem[], showBusiness: boolean): Column<AdminUser>[] {
  return [
    {
      key: "name",
      header: "User",
      cell: (u) => (
        <>
          <strong>{u.full_name}</strong>
          <span className="cell-note"> · {u.email}</span>
        </>
      ),
    },
    ...(showBusiness
      ? [{
          key: "business",
          header: "Business",
          cell: (u: AdminUser) =>
            u.tenant_id ? (
              <Link className="table-link" to={`/platform/businesses/${u.tenant_id}`}>{u.business_name}</Link>
            ) : (
              <span className="muted-text">Platform</span>
            ),
        }]
      : []),
    {
      key: "role",
      header: "Role",
      cell: (u) => (u.is_superadmin ? <Badge tone="info" icon={ShieldCheck}>Super admin</Badge> : ROLE_LABELS[u.role]),
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <>
          <AccountStatusBadge suspendedAt={u.suspended_at} />
          {!u.is_verified && <span className="cell-note"> · unverified</span>}
        </>
      ),
    },
    { key: "last_login", header: "Last sign-in", cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : "Never") },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (u) => {
        const items = actions(u);
        return items.length ? <ActionsMenu label={`Actions for ${u.email}`} items={items} /> : null;
      },
    },
  ];
}

/* ---------- Overview ---------- */

function Stat({ icon: Icon, label, value, note, tone, to }: { icon: LucideIcon; label: string; value: string; note?: string; tone?: "danger" | "success"; to?: string }) {
  const body = (
    <>
      <span className={`stat-icon${tone ? ` stat-icon--${tone}` : ""}`}><Icon size={18} aria-hidden /></span>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </>
  );
  return to ? <Link to={to} className="stat-card stat-card--link">{body}</Link> : <div className="stat-card">{body}</div>;
}

export function PlatformDashboardPage() {
  useDocumentTitle("Platform overview");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStats(await platformApi.stats());
    } catch (err) {
      setError(errorMessage(err, "Could not load platform stats."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack">
      <PageHeader title="Platform overview" subtitle="Every business and user on the platform." />
      {error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : !stats ? (
        <div className="stat-grid">
          {Array.from({ length: 4 }, (_, i) => <div className="stat-card" key={i}><Skeleton width="60%" /><Skeleton width="80%" /></div>)}
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat icon={Building2} label="Businesses" value={String(stats.businesses_total)} note={`${stats.businesses_active} active`} to="/platform/businesses" />
            <Stat
              icon={PauseCircle}
              label="Suspended businesses"
              value={String(stats.businesses_suspended)}
              tone={stats.businesses_suspended ? "danger" : undefined}
            />
            <Stat icon={Users} label="Users" value={String(stats.users_total)} note={`${stats.users_suspended} suspended`} to="/platform/users" />
            <Stat icon={CheckCircle2} label="New businesses" value={String(stats.signups_last_30_days)} note="Last 30 days" tone="success" />
          </div>
          <div className="stat-grid stat-grid--two">
            <Stat icon={ReceiptText} label="Receipts issued" value={String(stats.receipts_total)} />
            <Stat icon={ScrollText} label="Invoices" value={String(stats.invoices_total)} />
          </div>
          <Card>
            <CardHeader title="Receipt totals by currency" description="Across all businesses, all time." />
            {stats.receipt_totals.length === 0 ? (
              <p className="muted-text">No receipts yet.</p>
            ) : (
              <dl className="definition-list">
                {stats.receipt_totals.map((t) => (
                  <div key={t.currency}>
                    <dt>{t.currency}</dt>
                    <dd>
                      {formatMoney(t.amount_cents, t.currency)}
                      <span className="cell-note"> · {t.count} receipts</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Businesses ---------- */

export function PlatformBusinessesPage() {
  useDocumentTitle("Businesses");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const q = useDebounced(query);

  const fetchPage = useCallback(
    (limit: number, offset: number) => platformApi.businesses({ q: q || undefined, status: status || undefined, limit, offset }),
    [q, status],
  );
  const list = usePagedList(fetchPage, "Could not load businesses.");
  const actions = useBusinessActions(list.reload);

  const columns: Column<AdminBusiness>[] = [
    {
      key: "name",
      header: "Business",
      cell: (b) => (
        <>
          <Link className="table-link" to={`/platform/businesses/${b.id}`}><strong>{b.business_name}</strong></Link>
          {b.owner_email && <span className="cell-note"> · {b.owner_email}</span>}
        </>
      ),
    },
    { key: "status", header: "Status", cell: (b) => <AccountStatusBadge suspendedAt={b.suspended_at} /> },
    { key: "users", header: "Users", align: "end", cell: (b) => b.user_count },
    { key: "receipts", header: "Receipts", align: "end", cell: (b) => b.receipt_count },
    { key: "last_login", header: "Last sign-in", cell: (b) => (b.last_login_at ? formatDateTime(b.last_login_at) : "Never") },
    { key: "created", header: "Joined", cell: (b) => formatDate(b.created_at) },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (b) => <ActionsMenu label={`Actions for ${b.business_name}`} items={actions.items(b, true)} />,
    },
  ];

  const filtered = Boolean(q || status);

  return (
    <div>
      <PageHeader title="Businesses" subtitle="Every business registered on the platform." />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter businesses">
          <SearchField id="business_q" value={query} onChange={setQuery} placeholder="Business name or a user's email" />
          <Field label="Status" htmlFor="business_status">
            <Select id="business_status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Businesses"
          columns={columns}
          rows={list.rows}
          rowKey={(b) => b.id}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={list.reload}
          itemLabel="businesses"
          serverPaging={list.paging}
          empty={
            filtered ? (
              <EmptyState icon={SearchX} title="No businesses match" description="Try a different name, email or status." />
            ) : (
              <EmptyState icon={Building2} title="No businesses yet" description="Businesses appear here when someone signs up." />
            )
          }
        />
      </Card>
      {actions.dialogs}
    </div>
  );
}

export function PlatformBusinessDetailPage() {
  const { tenantId = "" } = useParams();
  const [business, setBusiness] = useState<AdminBusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle(business?.business_name ?? "Business");

  const load = useCallback(async () => {
    setError(null);
    try {
      setBusiness(await platformApi.business(tenantId));
    } catch (err) {
      setError(errorMessage(err, "Could not load this business."));
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const businessActions = useBusinessActions(load);
  const userActions = useUserActions(load);

  if (error) {
    return (
      <div>
        <PageHeader title="Business" back={{ to: "/platform/businesses", label: "Businesses" }} />
        <Card><ErrorState message={error} onRetry={load} /></Card>
      </div>
    );
  }
  if (!business) {
    return (
      <div>
        <PageHeader title="Business" back={{ to: "/platform/businesses", label: "Businesses" }} />
        <Card><Skeleton width="40%" /><Skeleton width="70%" /></Card>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        title={business.business_name}
        subtitle={`Joined ${formatDate(business.created_at)}`}
        back={{ to: "/platform/businesses", label: "Businesses" }}
        actions={<ActionsMenu label={`Actions for ${business.business_name}`} items={businessActions.items(business, false)} />}
      />

      {business.suspended_at && (
        <Alert tone="warning">
          Suspended {formatDateTime(business.suspended_at)}
          {business.suspended_reason ? `: ${business.suspended_reason}` : ""}. Its users can't sign in.
        </Alert>
      )}

      <div className="stat-grid">
        <Stat icon={Users} label="Users" value={String(business.user_count)} />
        <Stat icon={Users} label="Customers" value={String(business.customer_count)} />
        <Stat icon={ReceiptText} label="Receipts" value={String(business.receipt_count)} />
        <Stat icon={ScrollText} label="Invoices" value={String(business.invoice_count)} />
      </div>

      <Card>
        <CardHeader title="Details" />
        <dl className="definition-list">
          <div><dt>Status</dt><dd><AccountStatusBadge suspendedAt={business.suspended_at} /></dd></div>
          <div><dt>Owner</dt><dd>{business.owner_email ?? "—"}</dd></div>
          <div><dt>Plan</dt><dd>{business.plan_tier.replace(/_/g, " ")}</dd></div>
          <div><dt>Currency</dt><dd>{business.default_currency}</dd></div>
          <div><dt>Timezone</dt><dd>{business.timezone}</dd></div>
          <div><dt>Contact email</dt><dd>{business.contact_email ?? "—"}</dd></div>
          <div><dt>Contact phone</dt><dd>{business.contact_phone ?? "—"}</dd></div>
          <div><dt>Address</dt><dd>{business.physical_address ?? "—"}</dd></div>
          <div><dt>Last sign-in</dt><dd>{business.last_login_at ? formatDateTime(business.last_login_at) : "Never"}</dd></div>
        </dl>
      </Card>

      <Card flush>
        <div className="card-pad">
          <CardHeader
            title="Users"
            action={
              <Link className="table-link" to={`/platform/audit-log?tenant_id=${business.id}`}>View audit log</Link>
            }
          />
        </div>
        <DataTable
          caption={`Users of ${business.business_name}`}
          columns={userColumns(userActions.items, false)}
          rows={business.users}
          rowKey={(u) => u.id}
          itemLabel="users"
          empty={<EmptyState icon={Users} title="No users" description="This business has no users." />}
        />
      </Card>

      {businessActions.dialogs}
      {userActions.dialogs}
    </div>
  );
}

/* ---------- Users ---------- */

export function PlatformUsersPage() {
  useDocumentTitle("Users");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [status, setStatus] = useState<"" | "active" | "suspended" | "unverified">("");
  const q = useDebounced(query);

  const fetchPage = useCallback(
    (limit: number, offset: number) =>
      platformApi.users({ q: q || undefined, role: role || undefined, status: status || undefined, limit, offset }),
    [q, role, status],
  );
  const list = usePagedList(fetchPage, "Could not load users.");
  const actions = useUserActions(list.reload);
  const filtered = Boolean(q || role || status);

  return (
    <div>
      <PageHeader title="Users" subtitle="Everyone with an account, across all businesses." />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter users">
          <SearchField id="user_q" value={query} onChange={setQuery} placeholder="Name or email" />
          <Field label="Role" htmlFor="user_role_filter">
            <Select id="user_role_filter" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="">All roles</option>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="user_status">
            <Select id="user_status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="unverified">Unverified email</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Users"
          columns={userColumns(actions.items, true)}
          rows={list.rows}
          rowKey={(u) => u.id}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={list.reload}
          itemLabel="users"
          serverPaging={list.paging}
          empty={
            filtered ? (
              <EmptyState icon={SearchX} title="No users match" description="Try a different name, email, role or status." />
            ) : (
              <EmptyState icon={Users} title="No users yet" />
            )
          }
        />
      </Card>
      {actions.dialogs}
    </div>
  );
}

/* ---------- Audit log ---------- */

export function PlatformAuditPage() {
  useDocumentTitle("Platform audit log");
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant_id") ?? undefined;
  const [platformOnly, setPlatformOnly] = useState(!tenantId);

  const fetchPage = useCallback(
    (limit: number, offset: number) =>
      platformApi.auditLogs({ tenant_id: tenantId, platform_only: platformOnly ? "true" : undefined, limit, offset }),
    [tenantId, platformOnly],
  );
  const list = usePagedList(fetchPage, "Could not load the audit log.");

  const columns: Column<PlatformAuditEntry>[] = [
    { key: "when", header: "When", cell: (a) => formatDateTime(a.created_at) },
    {
      key: "business",
      header: "Business",
      cell: (a) =>
        a.tenant_id ? (
          <Link className="table-link" to={`/platform/businesses/${a.tenant_id}`}>{a.business_name ?? "Business"}</Link>
        ) : (
          <span className="muted-text">Platform</span>
        ),
    },
    {
      key: "who",
      header: "Who",
      cell: (a) => (a.actor_name ? <>{a.actor_name}<span className="cell-note"> · {a.actor_email}</span></> : <span className="muted-text">Customer or system</span>),
    },
    { key: "what", header: "What", cell: (a) => activityLabel(a.action) },
    {
      key: "details",
      header: "Details",
      cell: (a) => {
        const reason = a.metadata?.reason;
        return <span className="cell-note">{typeof reason === "string" && reason ? `Reason: ${reason}` : "—"}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle={tenantId ? "Activity in one business." : "Activity across the platform."}
        back={tenantId ? { to: `/platform/businesses/${tenantId}`, label: "Business" } : undefined}
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter the audit log">
          <Field label="Show" htmlFor="audit_scope">
            <Select id="audit_scope" value={platformOnly ? "platform" : "all"} onChange={(e) => setPlatformOnly(e.target.value === "platform")}>
              <option value="platform">Platform admin actions</option>
              <option value="all">All activity</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Audit log"
          columns={columns}
          rows={list.rows}
          rowKey={(a) => a.id}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={list.reload}
          itemLabel="entries"
          serverPaging={list.paging}
          empty={<EmptyState icon={ScrollText} title="Nothing recorded yet" />}
        />
      </Card>
    </div>
  );
}
