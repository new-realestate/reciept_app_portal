import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, Plus, Search, SearchX, Users } from "lucide-react";
import { customersApi } from "../api/customers";
import { useAccess } from "../auth/AccessContext";
import { ApiError } from "../lib/apiClient";
import type { Customer, CustomerType } from "../lib/types";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { qk } from "../lib/queryKeys";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

type KindFilter = "" | "tenants" | "others";

const COLUMNS: Column<Customer>[] = [
  {
    key: "name",
    header: "Name",
    cell: (c) => (
      <span className="badge-row">
        <Link className="table-link" to={`/customers/${c.id}`}>
          {c.name}
        </Link>
        {c.renter_id && (
          <Badge tone="info" icon={Home}>
            Tenant
          </Badge>
        )}
        {c.status === "archived" && <Badge tone="neutral">Archived</Badge>}
      </span>
    ),
  },
  { key: "type", header: "Type", cell: (c) => (c.customer_type === "business" ? "Business" : "Individual") },
  { key: "email", header: "Email", cell: (c) => c.email ?? "—" },
  { key: "phone", header: "Phone", cell: (c) => c.phone ?? "—" },
];

export function CustomersPage() {
  useDocumentTitle("Customers");
  const { notify } = useToast();
  const { can } = useAccess();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const changeLimit = (n: number) => {
    setOffset(0);
    setLimit(n);
  };
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("");
  const [status, setStatus] = useState<"active" | "archived" | "">("active");
  const [showModal, setShowModal] = useState(false);

  const { data: page, isLoading, error, reload } = useApiQuery(qk.customers({ q: activeQuery, limit, offset, kind, status }), () => customersApi.listPage(activeQuery || undefined, limit, offset, { status: status || undefined, is_renter: kind === "" ? undefined : kind === "tenants" }), {
    fallbackError: "Could not load customers.",
    keepPrevious: true,
  });
  const customers = page?.items ?? [];
  const total = page?.total ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setActiveQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = Boolean(activeQuery || kind || status !== "active");

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Everyone you issue receipts, invoices or quotations to — tenants and non-tenants alike."
        actions={
          can("customers.manage") && (
            <Button icon={Plus} onClick={() => setShowModal(true)}>
              Add customer
            </Button>
          )
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
          <Field label="Show" htmlFor="cust_kind">
            <Select id="cust_kind" value={kind} onChange={(e) => { setOffset(0); setKind(e.target.value as KindFilter); }}>
              <option value="">All customers</option>
              <option value="tenants">Tenants</option>
              <option value="others">Not tenants</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="cust_status">
            <Select id="cust_status" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value as "active" | "archived" | ""); }}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="">All</option>
            </Select>
          </Field>
        </div>

        <DataTable
          caption="Customers"
          columns={COLUMNS}
          rows={customers}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => reload()}
          itemLabel="customers"
          serverPaging={{ total, offset, limit, onOffsetChange: setOffset, onLimitChange: changeLimit }}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No customers match"
                description="Check the spelling, or try part of an email or phone number."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setKind("");
                      setStatus("active");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Customers are added automatically when you issue them a document, or use Add customer above."
              />
            )
          }
        />
      </Card>

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onOpenExisting={(id) => navigate(`/customers/${id}`)}
          onCreated={() => {
            setShowModal(false);
            notify("Customer added.", "success");
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddCustomerModal({
  onClose,
  onCreated,
  onOpenExisting,
}: {
  onClose: () => void;
  onCreated: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<CustomerType>("individual");
  const [billing, setBilling] = useState("");
  const [taxId, setTaxId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Customer[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(e: FormEvent | null, allowDuplicate = false) {
    e?.preventDefault();
    setFormError(null);
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim() && !phone.trim()) next.contact = "Provide an email or phone number.";
    setErrors(next);
    if (next.name) return document.getElementById("modal_name")?.focus();
    if (next.contact) return document.getElementById("modal_email")?.focus();

    setIsSubmitting(true);
    try {
      await customersApi.create({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        customer_type: type,
        billing_address: billing.trim() || undefined,
        tax_identification_number: taxId.trim() || undefined,
        allow_duplicate: allowDuplicate || undefined,
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && Array.isArray(err.data?.matches)) {
        setMatches(err.data.matches as Customer[]);
      } else {
        setFormError(err instanceof ApiError ? err.message : "Could not add the customer.");
      }
      setIsSubmitting(false);
    }
  }

  if (matches) {
    return (
      <Modal title="This customer may already exist" description="A customer with the same email or phone number is already on file." onClose={onClose}>
        <div className="stack">
          <ul className="match-list">
            {matches.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.name}</strong>
                  <span className="muted-text"> {[m.email, m.phone].filter(Boolean).join(" · ")}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => onOpenExisting(m.id)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setMatches(null)}>
              Go back
            </Button>
            <Button variant="ghost" isLoading={isSubmitting} onClick={() => submit(null, true)}>
              They're different — add anyway
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add customer" onClose={onClose}>
      <form onSubmit={(e) => submit(e)} noValidate className="stack">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Name" htmlFor="modal_name" required error={errors.name}>
          <Input id="modal_name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="modal_type">
          <Select id="modal_type" value={type} onChange={(e) => setType(e.target.value as CustomerType)}>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </Select>
        </Field>
        <Field label="Email" htmlFor="modal_email" error={errors.contact} hint="Email or phone is required.">
          <Input id="modal_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="modal_phone" hint="International format, e.g. +256701234567">
          <Input id="modal_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Billing address" htmlFor="modal_billing">
          <Textarea id="modal_billing" rows={2} value={billing} onChange={(e) => setBilling(e.target.value)} />
        </Field>
        {type === "business" && (
          <Field label="Tax ID" htmlFor="modal_tax">
            <Input id="modal_tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </Field>
        )}
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
