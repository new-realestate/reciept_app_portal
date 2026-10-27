import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, FilterX, MoreHorizontal, ReceiptText, Search, SearchX } from "lucide-react";
import { receiptsApi } from "../api/receipts";
import { formatDate, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type Receipt, type ReceiptListFilters, type ReceiptStatus } from "../lib/types";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../components/ui/ui";
import { PropertyFilter } from "../components/documents/PropertyFilter";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { ReceiptStatusBadge } from "../components/ui/StatusBadge";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

export function ReceiptsPage() {
  useDocumentTitle("Receipts");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [filters, setFilters] = useState<ReceiptListFilters>({});
  const [payerInput, setPayerInput] = useState("");

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  const { data: page, isLoading, error, reload } = useApiQuery(qk.receipts({ filters, limit, offset }), () => receiptsApi.listPage(filters, limit, offset), {
    fallbackError: "Could not load receipts.",
    keepPrevious: true,
  });
  const receipts = page?.items ?? [];
  const total = page?.total ?? 0;

  // Search by payer as the user types, without firing a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        const next = payerInput.trim() || undefined;
        if (prev.payer_name === next) return prev;
        setOffset(0);
        return { ...prev, payer_name: next };
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [payerInput]);

  function updateFilter<K extends keyof ReceiptListFilters>(key: K, value: ReceiptListFilters[K]) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setPayerInput("");
    setOffset(0);
    setFilters({});
  }

  const columns: Column<Receipt>[] = [
    {
      key: "reference_number",
      header: "Receipt #",
      cell: (r) => (
        <Link to={`/receipts/${r.id}`} className="table-link">
          {r.reference_number}
        </Link>
      ),
    },
    { key: "paid_at", header: "Date paid", cell: (r) => formatDate(r.paid_at) },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      cell: (r) => formatMoney(r.amount_cents, r.currency),
    },
    { key: "method", header: "Method", cell: (r) => PAYMENT_METHOD_LABELS[r.payment_method] },
    { key: "status", header: "Status", cell: (r) => <ReceiptStatusBadge status={r.status} /> },
    { key: "issuer", header: "Issued by", cell: (r) => r.issuer_printed_name },
    {
      key: "actions",
      header: "Actions",
      actions: true,
      cell: (r) => (
        <DropdownMenu
          label={`Actions for receipt ${r.reference_number}`}
          triggerClassName="icon-btn"
          items={[
            { label: "View details", icon: Eye, to: `/receipts/${r.id}` },
            ...(r.pdf_url ? [{ label: "Download PDF", icon: Download, href: r.pdf_url }] : []),
          ]}
        >
          <MoreHorizontal size={18} aria-hidden />
          <span className="sr-only">Actions for receipt {r.reference_number}</span>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Receipts"
        subtitle={
          isLoading || error
            ? "Every payment recorded and delivered to a payer."
            : `${total} ${total === 1 ? "receipt" : "receipts"}${hasFilters ? " match your filters" : ""}`
        }
      />

      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter receipts">
          <Field label="Payer" htmlFor="payer_name" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input
                id="payer_name"
                type="search"
                placeholder="Search by payer name"
                value={payerInput}
                onChange={(e) => setPayerInput(e.target.value)}
              />
            </div>
          </Field>
          <PropertyFilter id="rc_property" value={filters.property_id ?? ""} onChange={(v) => updateFilter("property_id", v)} />
          <Field label="From" htmlFor="date_from">
            <Input
              id="date_from"
              type="date"
              value={filters.date_from ?? ""}
              onChange={(e) => updateFilter("date_from", e.target.value || undefined)}
            />
          </Field>
          <Field label="To" htmlFor="date_to">
            <Input
              id="date_to"
              type="date"
              value={filters.date_to ?? ""}
              onChange={(e) => updateFilter("date_to", e.target.value || undefined)}
            />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={filters.status ?? ""}
              onChange={(e) => updateFilter("status", (e.target.value || undefined) as ReceiptStatus | undefined)}
            >
              <option value="">All statuses</option>
              <option value="issued">Issued</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </Select>
          </Field>
          {(hasFilters || payerInput) && (
            <Button variant="ghost" icon={FilterX} onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        <DataTable
          caption="Receipts"
          columns={columns}
          rows={receipts}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => reload()}
          itemLabel="receipts"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="No receipts match your filters"
                description="Try a different name or date range, or clear the filters to see everything."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No receipts yet"
                description="Once you record a local payment with New receipt, it will appear here."
              />
            )
          }
        />
      </Card>
    </div>
  );
}
