import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Eye, FileText, FilterX, MoreHorizontal, Plus, Search, SearchX } from "lucide-react";
import { invoicesApi } from "../api/documents";
import { ApiError } from "../lib/apiClient";
import type { Invoice, InvoiceListFilters } from "../lib/documentTypes";
import { formatDay, formatMoney } from "../lib/format";
import { Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select } from "../components/ui/ui";
import { PropertyFilter } from "../components/documents/PropertyFilter";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { InvoiceStatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";

const PAGE_SIZE = 15;

export function InvoicesPage() {
  useDocumentTitle("Invoices");
  const { notify } = useToast();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<InvoiceListFilters>(() => ({ status: searchParams.get("status") ?? undefined }));
  const [search, setSearch] = useState("");

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "") || search !== "";

  const { data: page, isLoading, error, reload } = useApiQuery(qk.invoices({ filters, limit, offset }), () => invoicesApi.list({ ...filters, limit, offset }), {
    fallbackError: "Could not load invoices.",
    keepPrevious: true,
  });
  const items = page?.items ?? [];
  const total = page?.total ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        const next = search.trim() || undefined;
        if (prev.q === next) return prev;
        setOffset(0);
        return { ...prev, q: next };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  function setFilter<K extends keyof InvoiceListFilters>(key: K, value: InvoiceListFilters[K]) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clear() {
    setSearch("");
    setOffset(0);
    setFilters({});
  }

  const columns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Invoice #",
      cell: (i) => (
        <Link to={`/invoices/${i.id}`} className="table-link">
          {i.number ?? "Draft"}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", cell: (i) => i.customer_name ?? "—" },
    { key: "issue", header: "Issued", cell: (i) => formatDay(i.issue_date) },
    {
      key: "due",
      header: "Due",
      cell: (i) => (
        <>
          {formatDay(i.due_date)}
          {i.days_overdue > 0 && <span className="cell-note cell-note--danger"> {i.days_overdue}d overdue</span>}
        </>
      ),
    },
    { key: "total", header: "Total", align: "end", cell: (i) => formatMoney(i.total_cents, i.currency) },
    {
      key: "balance",
      header: "Balance",
      align: "end",
      cell: (i) => (i.status === "issued" ? formatMoney(i.outstanding_cents, i.currency) : "—"),
    },
    { key: "status", header: "Status", cell: (i) => <InvoiceStatusBadge status={i.display_status} /> },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (i) => (
        <DropdownMenu
          label={`Actions for invoice ${i.number ?? "draft"}`}
          triggerClassName="icon-btn"
          items={[
            { label: "View details", icon: Eye, to: `/invoices/${i.id}` },
            {
              label: "Download PDF",
              icon: Download,
              onSelect: () =>
                invoicesApi.downloadPdf(i.id, i.number ?? "invoice-draft").catch((e) => notify(e instanceof ApiError ? e.message : "Download failed.", "error")),
            },
          ]}
        >
          <MoreHorizontal size={18} aria-hidden />
          <span className="sr-only">Actions for invoice {i.number ?? "draft"}</span>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={isLoading || error ? "Request payment and track what is still owed." : `${total} ${total === 1 ? "invoice" : "invoices"}${hasFilters ? " match your filters" : ""}`}
        actions={
          <ButtonLink to="/invoices/new" icon={Plus}>
            New invoice
          </ButtonLink>
        }
      />

      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter invoices">
          <Field label="Search" htmlFor="inv_q" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input id="inv_q" type="search" placeholder="Invoice number, title or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
          <Field label="Status" htmlFor="inv_status">
            <Select id="inv_status" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value || undefined)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="unpaid">Unpaid (any)</option>
              <option value="issued">Issued, not yet due</option>
              <option value="partially_paid">Partially paid</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <PropertyFilter id="inv_property" value={filters.property_id ?? ""} onChange={(v) => setFilter("property_id", v)} />
          <Field label="Issued from" htmlFor="inv_from">
            <Input id="inv_from" type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value || undefined)} />
          </Field>
          <Field label="Issued to" htmlFor="inv_to">
            <Input id="inv_to" type="date" value={filters.date_to ?? ""} onChange={(e) => setFilter("date_to", e.target.value || undefined)} />
          </Field>
          {hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={clear}>
              Clear
            </Button>
          )}
        </div>

        <DataTable
          caption="Invoices"
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          isLoading={isLoading}
          error={error}
          onRetry={reload}
          itemLabel="invoices"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="No invoices match your filters"
                description="Try a different search or status, or clear the filters."
                action={<Button variant="secondary" onClick={clear}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Create an invoice to request payment. When money arrives, record it against the invoice and a receipt is issued."
                action={<ButtonLink to="/invoices/new" icon={Plus}>Create your first invoice</ButtonLink>}
              />
            )
          }
        />
      </Card>
    </div>
  );
}
