import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { receiptsApi } from "../api/receipts";
import { ApiError } from "../lib/apiClient";
import { formatDate, formatMoney } from "../lib/format";
import { PAYMENT_METHOD_LABELS, type Receipt, type ReceiptListFilters, type ReceiptStatus } from "../lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

const STATUS_TONE: Record<ReceiptStatus, "success" | "warning" | "danger"> = {
  issued: "success",
  voided: "danger",
  refunded: "warning",
};

export function ReceiptsPage() {
  const { notify } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReceiptListFilters>({});
  const [payerNameInput, setPayerNameInput] = useState("");

  const load = useCallback(
    async (activeFilters: ReceiptListFilters) => {
      setIsLoading(true);
      try {
        const data = await receiptsApi.list(activeFilters);
        setReceipts(data);
      } catch (err) {
        notify(err instanceof ApiError ? err.message : "Could not load receipts.", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = { ...filters, payer_name: payerNameInput || undefined };
    setFilters(next);
    load(next);
  }

  function updateFilter<K extends keyof ReceiptListFilters>(key: K, value: ReceiptListFilters[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    load(next);
  }

  return (
    <div>
      <PageHeader
        title="Receipts"
        subtitle="Every payment recorded and delivered to a payer."
        actions={
          <Link to="/receipts/new" className="btn btn--primary">
            + New receipt
          </Link>
        }
      />

      <Card className="filters-card">
        <form className="filters-row" onSubmit={handleSearch}>
          <Field label="Payer name" htmlFor="payer_name">
            <Input id="payer_name" placeholder="Search by name…" value={payerNameInput} onChange={(e) => setPayerNameInput(e.target.value)} />
          </Field>
          <Field label="From" htmlFor="date_from">
            <Input id="date_from" type="date" value={filters.date_from ?? ""} onChange={(e) => updateFilter("date_from", e.target.value || undefined)} />
          </Field>
          <Field label="To" htmlFor="date_to">
            <Input id="date_to" type="date" value={filters.date_to ?? ""} onChange={(e) => updateFilter("date_to", e.target.value || undefined)} />
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
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner label="Loading receipts…" />
        ) : receipts.length === 0 ? (
          <EmptyState
            title="No receipts yet"
            description="Issue your first receipt once you've recorded a local payment."
            action={
              <Link to="/receipts/new" className="btn btn--primary">
                + New receipt
              </Link>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date paid</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Issued by</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/receipts/${r.id}`} className="table-link">
                        {r.reference_number}
                      </Link>
                    </td>
                    <td>{formatDate(r.paid_at)}</td>
                    <td>{formatMoney(r.amount_cents, r.currency)}</td>
                    <td>{PAYMENT_METHOD_LABELS[r.payment_method]}</td>
                    <td>
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    </td>
                    <td>{r.issuer_printed_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
