import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Download, Eye, FilterX, MoreHorizontal, Plus, Search, SearchX } from "lucide-react";
import { quotationsApi } from "../api/documents";
import { ApiError } from "../lib/apiClient";
import type { InvoiceListFilters, Quotation } from "../lib/documentTypes";
import { formatDay, formatMoney } from "../lib/format";
import { Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select } from "../components/ui/ui";
import { PropertyFilter } from "../components/documents/PropertyFilter";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { QuotationStatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";

const PAGE_SIZE = 15;

export function QuotationsPage() {
  useDocumentTitle("Quotations");
  const { notify } = useToast();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [filters, setFilters] = useState<InvoiceListFilters>({});
  const [search, setSearch] = useState("");
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "") || search !== "";

  const { data: page, isLoading, error, reload } = useApiQuery(qk.quotations({ filters, limit, offset }), () => quotationsApi.list({ ...filters, limit, offset }), {
    fallbackError: "Could not load quotations.",
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

  const columns: Column<Quotation>[] = [
    {
      key: "number",
      header: "Quotation #",
      cell: (q) => (
        <Link to={`/quotations/${q.id}`} className="table-link">
          {q.number ?? "Draft"}
        </Link>
      ),
    },
    { key: "customer", header: "Customer", cell: (q) => q.customer_name ?? "—" },
    { key: "title", header: "Title", cell: (q) => q.title ?? "—" },
    { key: "valid", header: "Valid until", cell: (q) => formatDay(q.valid_until) },
    { key: "total", header: "Total", align: "end", cell: (q) => formatMoney(q.total_cents, q.currency) },
    { key: "status", header: "Status", cell: (q) => <QuotationStatusBadge status={q.display_status} /> },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (q) => (
        <DropdownMenu
          label={`Actions for quotation ${q.number ?? "draft"}`}
          triggerClassName="icon-btn"
          items={[
            { label: "View details", icon: Eye, to: `/quotations/${q.id}` },
            {
              label: "Download PDF",
              icon: Download,
              onSelect: () =>
                quotationsApi.downloadPdf(q.id, q.number ?? "quotation-draft").catch((e) => notify(e instanceof ApiError ? e.message : "Download failed.", "error")),
            },
          ]}
        >
          <MoreHorizontal size={18} aria-hidden />
          <span className="sr-only">Actions for quotation {q.number ?? "draft"}</span>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle={isLoading || error ? "Send estimates and track the answers." : `${total} ${total === 1 ? "quotation" : "quotations"}${hasFilters ? " match your filters" : ""}`}
        actions={
          <ButtonLink to="/quotations/new" icon={Plus}>
            New quotation
          </ButtonLink>
        }
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter quotations">
          <Field label="Search" htmlFor="quo_q" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input id="quo_q" type="search" placeholder="Quotation number, title or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
          <Field label="Status" htmlFor="quo_status">
            <Select id="quo_status" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value || undefined)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Awaiting answer</option>
              <option value="viewed">Viewed</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <PropertyFilter id="quo_property" value={filters.property_id ?? ""} onChange={(v) => setFilter("property_id", v)} />
          <Field label="Issued from" htmlFor="quo_from">
            <Input id="quo_from" type="date" value={filters.date_from ?? ""} onChange={(e) => setFilter("date_from", e.target.value || undefined)} />
          </Field>
          <Field label="Issued to" htmlFor="quo_to">
            <Input id="quo_to" type="date" value={filters.date_to ?? ""} onChange={(e) => setFilter("date_to", e.target.value || undefined)} />
          </Field>
          {hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <DataTable
          caption="Quotations"
          columns={columns}
          rows={items}
          rowKey={(q) => q.id}
          isLoading={isLoading}
          error={error}
          onRetry={reload}
          itemLabel="quotations"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            hasFilters ? (
              <EmptyState icon={SearchX} title="No quotations match your filters" description="Try a different search or status." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="No quotations yet"
                description="Prepare an estimate, share it with a customer, and convert it to an invoice once they accept."
                action={<ButtonLink to="/quotations/new" icon={Plus}>Create a quotation</ButtonLink>}
              />
            )
          }
        />
      </Card>
    </div>
  );
}
