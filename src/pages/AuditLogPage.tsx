import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FilterX, ScrollText, ShieldCheck } from "lucide-react";
import { auditApi, type AuditEntry, type AuditFilters } from "../api/audit";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import { activityLabel, entityLink } from "../lib/activity";
import { formatDateTime } from "../lib/format";
import { Badge, Button, Card, EmptyState, Field, Input, LockedNotice, PageHeader, Select } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 25;
const ENTITY_TYPES = ["invoice", "quotation", "receipt", "schedule", "tenant", "user", "notification"];

function details(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([k, v]) => k !== "platform_admin" && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export function AuditLogPage() {
  useDocumentTitle("Audit log");
  const { session } = useAuth();
  const allowed = session ? permissions.canManageDocuments(session.role) : false;

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [filters, setFilters] = useState<AuditFilters>({});
  const [actions, setActions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  useEffect(() => {
    if (allowed) auditApi.actions().then(setActions).catch(() => undefined);
  }, [allowed]);

  const load = useCallback(async () => {
    if (!allowed) return;
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await auditApi.list({ ...filters, limit, offset });
      if (id === requestId.current) {
        setItems(page.items);
        setTotal(page.total);
      }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load the audit log.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [filters, offset, limit, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  function setFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Audit log" subtitle="A record of who did what in your business." />
        <Card>
          <LockedNotice>Only an Owner or Admin can view the audit log.</LockedNotice>
        </Card>
      </div>
    );
  }

  const columns: Column<AuditEntry>[] = [
    { key: "when", header: "When", cell: (a) => formatDateTime(a.created_at) },
    {
      key: "who",
      header: "Who",
      cell: (a) =>
        a.actor_name ? (
          <>
            {a.actor_name}
            {a.actor_email && <span className="cell-note"> · {a.actor_email}</span>}
            {a.platform_admin && (
              <>
                {" "}
                <Badge tone="info" icon={ShieldCheck}>Platform admin</Badge>
              </>
            )}
          </>
        ) : (
          <span className="muted-text">Customer or system</span>
        ),
    },
    {
      key: "what",
      header: "What",
      cell: (a) => {
        const href = entityLink(a.entity_type, a.entity_id);
        const label = activityLabel(a.action);
        return href ? <Link className="table-link" to={href}>{label}</Link> : label;
      },
    },
    { key: "details", header: "Details", cell: (a) => <span className="cell-note">{details(a.metadata) || "—"}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle={isLoading || error ? "A record of who did what in your business." : `${total} ${total === 1 ? "entry" : "entries"}${hasFilters ? " match your filters" : ""}`}
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter the audit log">
          <Field label="Action" htmlFor="audit_action">
            <Select id="audit_action" value={filters.action ?? ""} onChange={(e) => setFilter("action", e.target.value || undefined)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{activityLabel(a)}</option>
              ))}
            </Select>
          </Field>
          <Field label="About" htmlFor="audit_entity">
            <Select id="audit_entity" value={filters.entity_type ?? ""} onChange={(e) => setFilter("entity_type", e.target.value || undefined)}>
              <option value="">Anything</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </Field>
          <Field label="From" htmlFor="audit_from">
            <Input id="audit_from" type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value || undefined)} />
          </Field>
          <Field label="To" htmlFor="audit_to">
            <Input id="audit_to" type="date" value={filters.date_to ?? ""} onChange={(e) => setFilter("date_to", e.target.value || undefined)} />
          </Field>
          {hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={() => { setOffset(0); setFilters({}); }}>
              Clear
            </Button>
          )}
        </div>
        <DataTable
          caption="Audit log"
          columns={columns}
          rows={items}
          rowKey={(a) => a.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="entries"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            <EmptyState
              icon={ScrollText}
              title={hasFilters ? "No entries match your filters" : "Nothing recorded yet"}
              description={hasFilters ? "Try a wider date range or clear the filters." : "Actions such as issuing invoices and recording payments appear here."}
            />
          }
        />
      </Card>
    </div>
  );
}
