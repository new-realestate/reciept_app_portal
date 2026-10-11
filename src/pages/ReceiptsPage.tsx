import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, FilterX, MoreHorizontal, ReceiptText, Search, SearchX } from "lucide-react";
import { receiptsApi } from "../api/receipts";
import { ApiError } from "../lib/apiClient";
import { formatDate, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type Receipt, type ReceiptListFilters, type ReceiptStatus } from "../lib/types";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { DropdownMenu } from "../components/ui/DropdownMenu";
import { ReceiptStatusBadge } from "../components/ui/StatusBadge";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const SEARCH_DEBOUNCE_MS = 300;

export function ReceiptsPage() {
  useDocumentTitle("Receipts");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReceiptListFilters>({});
  const [payerInput, setPayerInput] = useState("");
  const requestId = useRef(0);

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  const load = useCallback(async (activeFilters: ReceiptListFilters) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await receiptsApi.list(activeFilters);
      if (id === requestId.current) setReceipts(data);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load receipts.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  // Search by payer as the user types, without firing a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => {
        const next = payerInput.trim() || undefined;
        return prev.payer_name === next ? prev : { ...prev, payer_name: next };
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [payerInput]);

  function updateFilter<K extends keyof ReceiptListFilters>(key: K, value: ReceiptListFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setPayerInput("");
    setFilters({});
  }

  const columns: Column<Receipt>[] = [
    {
      key: "reference_number",
      header: "Receipt #",
      sortValue: (r) => r.reference_number,
      cell: (r) => (
        <Link to={`/receipts/${r.id}`} className="table-link">
          {r.reference_number}
        </Link>
      ),
    },
    { key: "paid_at", header: "Date paid", sortValue: (r) => r.paid_at, cell: (r) => formatDate(r.paid_at) },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      sortValue: (r) => r.amount_cents,
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
            : `${receipts.length} ${receipts.length === 1 ? "receipt" : "receipts"}${hasFilters ? " match your filters" : ""}`
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
          onRetry={() => load(filters)}
          itemLabel="receipts"
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
