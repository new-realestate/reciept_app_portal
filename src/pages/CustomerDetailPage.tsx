import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ClipboardList, FileText, Home, ReceiptText } from "lucide-react";
import { customersApi } from "../api/customers";
import { useAccess } from "../auth/AccessContext";
import { ApiError } from "../lib/apiClient";
import { formatDate, formatMoney } from "../lib/format";
import type { Customer, CustomerDocuments, CustomerDocumentSummary, CustomerType } from "../lib/types";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
} from "../components/ui/ui";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { NoAccess } from "../components/RequirePerm";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../lib/queryKeys";
import { detailQueries } from "../lib/detailQueries";

const DOC_PATHS = { receipt: "/receipts", invoice: "/invoices", quotation: "/quotations" } as const;

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Receipts, invoices and quotations for one customer (only those the viewer may see). */
export function DocumentHistory({ docs }: { docs: CustomerDocuments }) {
  const [tab, setTab] = useState<"receipts" | "invoices" | "quotations">("receipts");
  const rows: CustomerDocumentSummary[] = docs[tab];
  const owed = Object.entries(docs.outstanding_by_currency);

  return (
    <Card>
      <CardHeader
        title="Documents"
        description={owed.length ? `Outstanding: ${owed.map(([cur, cents]) => formatMoney(cents, cur)).join(", ")}` : "Nothing outstanding."}
      />
      <div className="tab-bar">
        <SegmentedControl
          label="Document type"
          value={tab}
          onChange={setTab}
          options={[
            { value: "receipts", label: `Receipts (${docs.receipts.length})` },
            { value: "invoices", label: `Invoices (${docs.invoices.length})` },
            { value: "quotations", label: `Quotations (${docs.quotations.length})` },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="muted-text">None yet.</p>
      ) : (
        <ul className="member-list">
          {rows.map((d) => (
            <li key={d.id}>
              <span>
                <Link className="table-link" to={`${DOC_PATHS[d.kind]}/${d.id}`}>
                  {d.number ?? "Draft"}
                </Link>
                <span className="muted-text"> · {formatDate(d.date)}</span>
              </span>
              <span className="badge-row">
                <strong>{formatMoney(d.amount_cents, d.currency)}</strong>
                {d.outstanding_cents ? <Badge tone="warning">{formatMoney(d.outstanding_cents, d.currency)} due</Badge> : null}
                <Badge tone="neutral">{statusLabel(d.status)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CustomerDetailPage() {
  const { customerId = "" } = useParams();
  const { can } = useAccess();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const customerDef = detailQueries.customer(customerId);
  const query = useApiQuery(customerDef.queryKey, customerDef.queryFn, {
    fallbackError: "Could not load the customer.",
  });
  const docs: CustomerDocuments | null = query.data ?? null;
  const error = query.error ? { message: query.error, status: query.errorStatus ?? 0 } : null;
  const load = query.reload;
  const setDocs = (update: (d: CustomerDocuments | undefined) => CustomerDocuments | undefined) =>
    queryClient.setQueryData(qk.customerDocuments(customerId), update);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const customer = docs?.customer;
  useDocumentTitle(customer?.name ?? "Customer");


  if (error?.status === 404) return <NoAccess message="This customer doesn't exist in your business." />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!docs || !customer) return <Spinner label="Loading customer…" />;

  const canManage = can("customers.manage");
  const archived = customer.status === "archived";

  async function toggleArchive() {
    setBusy(true);
    try {
      const updated = archived ? await customersApi.restore(customer!.id) : await customersApi.archive(customer!.id);
      setDocs((d) => (d ? { ...d, customer: updated } : d));
      notify(archived ? "Customer restored." : "Customer archived.", "success");
      setArchiving(false);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "That didn't work.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        back={{ to: "/customers", label: "Customers" }}
        title={customer.name}
        subtitle={customer.customer_type === "business" ? "Business customer" : "Individual customer"}
        actions={
          <>
            {archived && <Badge tone="neutral">Archived</Badge>}
            {customer.renter_id && (
              <ButtonLink to={`/tenants/${customer.renter_id}`} variant="secondary" icon={Home}>
                Tenant profile
              </ButtonLink>
            )}
            {!archived && can("receipts.issue") && (
              <ButtonLink to={`/receipts/new?customer=${customer.id}`} icon={ReceiptText} variant="secondary">
                Receipt
              </ButtonLink>
            )}
            {!archived && can("invoices.issue") && (
              <ButtonLink to={`/invoices/new?customer=${customer.id}`} icon={FileText} variant="secondary">
                Invoice
              </ButtonLink>
            )}
            {!archived && can("quotations.issue") && (
              <ButtonLink to={`/quotations/new?customer=${customer.id}`} icon={ClipboardList} variant="secondary">
                Quotation
              </ButtonLink>
            )}
          </>
        }
      />

      {archived && <Alert tone="info">This customer is archived. Restore them to issue new documents; their history stays visible.</Alert>}

      <div className="page-grid page-grid--wide-left">
        <DocumentHistory docs={docs} />
        <Card>
          <CardHeader
            title="Contact and billing"
            action={
              canManage && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )
            }
          />
          <dl className="definition-list">
            <div>
              <dt>Email</dt>
              <dd>{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{customer.phone ?? "—"}</dd>
            </div>
            {customer.legal_name && (
              <div>
                <dt>Legal name</dt>
                <dd>{customer.legal_name}</dd>
              </div>
            )}
            <div>
              <dt>Billing address</dt>
              <dd className="pre-wrap">{customer.billing_address ?? "—"}</dd>
            </div>
            {customer.tax_identification_number && (
              <div>
                <dt>Tax ID</dt>
                <dd>{customer.tax_identification_number}</dd>
              </div>
            )}
            {customer.notes && (
              <div>
                <dt>Notes</dt>
                <dd className="pre-wrap">{customer.notes}</dd>
              </div>
            )}
          </dl>
          <p className="muted-text">Editing contact details doesn't change documents already issued.</p>
          {canManage && (
            <div className="action-bar">
              {!customer.renter_id && !archived && can("renters.manage") && (
                <ButtonLink to={`/tenants/new?customer=${customer.id}`} variant="ghost" icon={Home}>
                  Make tenant
                </ButtonLink>
              )}
              <Button variant="ghost" icon={archived ? ArchiveRestore : Archive} onClick={() => (archived ? toggleArchive() : setArchiving(true))}>
                {archived ? "Restore" : "Archive"}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {editing && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setDocs((d) => (d ? { ...d, customer: c } : d));
            setEditing(false);
            notify("Customer updated.", "success");
          }}
        />
      )}
      {archiving && (
        <ConfirmDialog
          title={`Archive ${customer.name}?`}
          description="They're hidden from pickers and can't receive new documents. Their documents and history are kept."
          confirmLabel="Archive"
          tone="danger"
          isLoading={busy}
          onConfirm={toggleArchive}
          onCancel={() => setArchiving(false)}
        />
      )}
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [type, setType] = useState<CustomerType>(customer.customer_type);
  const [legalName, setLegalName] = useState(customer.legal_name ?? "");
  const [billing, setBilling] = useState(customer.billing_address ?? "");
  const [taxId, setTaxId] = useState(customer.tax_identification_number ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError("Name is required.");
    if (!email.trim() && !phone.trim()) return setFormError("Keep an email or a phone number.");
    setBusy(true);
    try {
      onSaved(
        await customersApi.update(customer.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          customer_type: type,
          legal_name: legalName.trim() || undefined,
          billing_address: billing.trim() || undefined,
          tax_identification_number: taxId.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit customer" onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label="Name" htmlFor="ec_name" required className="form-grid-full">
            <Input id="ec_name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="ec_email">
            <Input id="ec_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="ec_phone">
            <Input id="ec_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="ec_type">
            <Select id="ec_type" value={type} onChange={(e) => setType(e.target.value as CustomerType)}>
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </Select>
          </Field>
          <Field label="Legal / registered name" htmlFor="ec_legal">
            <Input id="ec_legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </Field>
          <Field label="Billing address" htmlFor="ec_billing" className="form-grid-full">
            <Textarea id="ec_billing" rows={2} value={billing} onChange={(e) => setBilling(e.target.value)} />
          </Field>
          <Field label="Tax ID" htmlFor="ec_tax">
            <Input id="ec_tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="ec_notes" className="form-grid-full" hint="Internal only.">
            <Textarea id="ec_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
