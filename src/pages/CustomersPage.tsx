import { useEffect, useState, type FormEvent } from "react";
import { customersApi } from "../api/customers";
import { ApiError } from "../lib/apiClient";
import type { Customer } from "../lib/types";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

export function CustomersPage() {
  const { notify } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load(q?: string) {
    setIsLoading(true);
    try {
      const data = await customersApi.list(q);
      setCustomers(data);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not load customers.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    load(query || undefined);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormError("Provide an email or phone number.");
      return;
    }
    setIsSubmitting(true);
    try {
      await customersApi.create({ name, email: email || undefined, phone: phone || undefined });
      notify("Customer added.", "success");
      setShowModal(false);
      setName("");
      setEmail("");
      setPhone("");
      load(query || undefined);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add customer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Payers you've issued receipts to."
        actions={
          <Button onClick={() => setShowModal(true)} variant="primary">
            + Add customer
          </Button>
        }
      />

      <Card className="filters-card">
        <form className="filters-row" onSubmit={handleSearch}>
          <Field label="Search" htmlFor="q">
            <Input id="q" placeholder="Name, email, or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner label="Loading customers…" />
        ) : customers.length === 0 ? (
          <EmptyState title="No customers yet" description="Customers are created automatically the first time you issue them a receipt, or you can add one here." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>{c.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <Modal title="Add customer" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="auth-form">
            {formError && <div className="alert alert--error">{formError}</div>}
            <Field label="Name" htmlFor="modal_name" required>
              <Input id="modal_name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="modal_email">
              <Input id="modal_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="modal_phone" hint="E.164 format, e.g. +256701234567">
              <Input id="modal_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button type="submit" className="btn--full" isLoading={isSubmitting}>
              Add customer
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
