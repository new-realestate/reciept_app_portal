import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Search, SearchX, Users } from "lucide-react";
import { customersApi } from "../api/customers";
import { ApiError } from "../lib/apiClient";
import type { Customer } from "../lib/types";
import { Alert, Button, Card, EmptyState, Field, Input, PageHeader } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

const COLUMNS: Column<Customer>[] = [
  { key: "name", header: "Name", cell: (c) => <strong>{c.name}</strong> },
  { key: "email", header: "Email", cell: (c) => c.email ?? "—" },
  { key: "phone", header: "Phone", cell: (c) => c.phone ?? "—" },
];

export function CustomersPage() {
  useDocumentTitle("Customers");
  const { notify } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (q: string, from: number) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await customersApi.listPage(q || undefined, limit, from);
      if (id === requestId.current) {
        setCustomers(page.items);
        setTotal(page.total);
      }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Could not load customers.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load(activeQuery, offset);
  }, [activeQuery, offset, load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setActiveQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="The payers you've issued receipts to."
        actions={
          <Button icon={Plus} onClick={() => setShowModal(true)}>
            Add customer
          </Button>
        }
      />

      <Card flush>
        <div className="filter-bar" role="search" aria-label="Search customers">
          <Field label="Search" htmlFor="q" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input
                id="q"
                type="search"
                placeholder="Name, email or phone"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>

        <DataTable
          caption="Customers"
          columns={COLUMNS}
          rows={customers}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => load(activeQuery, offset)}
          itemLabel="customers"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            activeQuery ? (
              <EmptyState
                icon={SearchX}
                title="No customers match your search"
                description="Check the spelling, or try part of an email or phone number."
                action={
                  <Button variant="secondary" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Customers are added automatically when you issue them a receipt, or use Add customer above."
              />
            )
          }
        />
      </Card>

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            notify("Customer added.", "success");
            load(activeQuery, offset);
          }}
        />
      )}
    </div>
  );
}

function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim() && !phone.trim()) next.contact = "Provide an email or phone number.";
    setErrors(next);
    if (next.name) return document.getElementById("modal_name")?.focus();
    if (next.contact) return document.getElementById("modal_email")?.focus();

    setIsSubmitting(true);
    try {
      await customersApi.create({ name, email: email || undefined, phone: phone || undefined });
      onCreated();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add the customer.");
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Add customer" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="stack">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Name" htmlFor="modal_name" required error={errors.name}>
          <Input id="modal_name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="modal_email" error={errors.contact} hint="Email or phone is required.">
          <Input id="modal_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="modal_phone" hint="International format, e.g. +256701234567">
          <Input id="modal_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Add customer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
