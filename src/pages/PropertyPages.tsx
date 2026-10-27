import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, Building, Home, Plus, Search, SearchX, UserMinus, UserPlus } from "lucide-react";
import { propertiesApi } from "../api/properties";
import { rentersApi } from "../api/renters";
import { teamApi } from "../api/team";
import { useAccess } from "../auth/AccessContext";
import { ApiError } from "../lib/apiClient";
import { centsFromInput, formatAmount, formatDate } from "../lib/format";
import {
  PROPERTY_TYPE_LABELS,
  UNIT_TYPE_LABELS,
  type Property,
  type PropertyDetail,
  type PropertyType,
  type Renter,
  type TeamMember,
  type UnitType,
} from "../lib/propertyTypes";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { KycStatusBadge, PropertyStatusBadge, RenterStatusBadge } from "../components/ui/StatusBadge";
import { NoAccess } from "../components/RequirePerm";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useApiQuery } from "../hooks/useApiQuery";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../lib/queryKeys";
import { detailQueries } from "../lib/detailQueries";

const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS: Column<Property>[] = [
  {
    key: "name",
    header: "Property",
    cell: (p) => (
      <Link className="table-link" to={`/properties/${p.id}`}>
        {p.name}
      </Link>
    ),
    sortValue: (p) => p.name.toLowerCase(),
  },
  { key: "type", header: "Type", cell: (p) => PROPERTY_TYPE_LABELS[p.property_type] },
  { key: "address", header: "Address", cell: (p) => p.address ?? "—" },
  {
    key: "units",
    header: "Occupied units",
    cell: (p) => (p.unit_count ? `${p.occupied_unit_count} of ${p.unit_count}` : "No units"),
    align: "end",
  },
  { key: "tenancies", header: "Active tenancies", cell: (p) => p.active_tenancy_count, align: "end", sortValue: (p) => p.active_tenancy_count },
  { key: "status", header: "Status", cell: (p) => <PropertyStatusBadge status={p.status} /> },
];

/* ------------------------------------------------------------------ list */

export function PropertiesPage() {
  useDocumentTitle("Properties");
  const { isManager } = useAccess();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error, reload: load } = useApiQuery(
    qk.properties({ q: activeQuery, status }),
    () => propertiesApi.list({ q: activeQuery || undefined, status: status || undefined }),
    { fallbackError: "Could not load properties.", keepPrevious: true },
  );
  const rows: Property[] = data ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={isManager ? "Your business's property portfolio." : "The properties assigned to you."}
        actions={
          isManager && (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Add property
            </Button>
          )
        }
      />
      <Card flush>
        <div className="filter-bar" role="search" aria-label="Filter properties">
          <Field label="Search" htmlFor="prop_q" className="field--grow">
            <div className="search-input">
              <Search size={16} aria-hidden />
              <Input id="prop_q" type="search" placeholder="Name, address or location" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </Field>
          <Field label="Status" htmlFor="prop_status">
            <Select id="prop_status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
              <option value="">All</option>
            </Select>
          </Field>
        </div>
        <DataTable
          caption="Properties"
          columns={COLUMNS}
          rows={rows}
          rowKey={(p) => p.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="properties"
          empty={
            activeQuery ? (
              <EmptyState icon={SearchX} title="No properties match your search" />
            ) : isManager ? (
              <EmptyState
                icon={Building}
                title="No properties yet"
                description="Add a property, then assign staff who will manage it."
                action={<Button icon={Plus} onClick={() => setCreating(true)}>Add property</Button>}
              />
            ) : (
              <EmptyState icon={Building} title="No properties assigned to you" description="Ask your business owner or an admin to assign you a property." />
            )
          }
        />
      </Card>
      {creating && (
        <PropertyModal
          onClose={() => setCreating(false)}
          onSaved={(p) => {
            setCreating(false);
            notify(`${p.name} added.`, "success");
            load();
          }}
        />
      )}
    </div>
  );
}

function PropertyModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: PropertyDetail;
  onClose: () => void;
  onSaved: (p: PropertyDetail) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<PropertyType>(existing?.property_type ?? "residential");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setNameError("Give the property a name.");
      document.getElementById("prop_name")?.focus();
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      property_type: type,
      address: address.trim() || undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };
    try {
      onSaved(existing ? await propertiesApi.update(existing.id, payload) : await propertiesApi.create(payload));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the property.");
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? "Edit property" : "Add property"} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Name" htmlFor="prop_name" required error={nameError ?? undefined}>
          <Input id="prop_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Palm Court Apartments" />
        </Field>
        <Field label="Type" htmlFor="prop_type">
          <Select id="prop_type" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
            {(Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Physical address" htmlFor="prop_address">
          <Input id="prop_address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Location" htmlFor="prop_location" hint="Area, town or a map reference.">
          <Input id="prop_location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="prop_desc">
          <Textarea id="prop_desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            {existing ? "Save" : "Add property"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ detail */

export function PropertyDetailPage() {
  const { propertyId = "" } = useParams();
  const { isManager, can } = useAccess();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const propertyDef = detailQueries.property(propertyId);
  const propertyQuery = useApiQuery(propertyDef.queryKey, propertyDef.queryFn, {
    fallbackError: "Could not load the property.",
  });
  const rentersQuery = useApiQuery(
    qk.renters({ property_id: propertyId }),
    () => rentersApi.listPage({ property_id: propertyId }, 100, 0).then((p) => p.items),
    { enabled: can("renters.manage") },
  );
  const property = propertyQuery.data ?? null;
  const renters: Renter[] = rentersQuery.data ?? [];
  const error = propertyQuery.error ? { message: propertyQuery.error, status: propertyQuery.errorStatus ?? 0 } : null;
  // Actions return the updated property; show it at once (a background refetch follows).
  const setProperty = (p: PropertyDetail) => queryClient.setQueryData(qk.property(propertyId), p);
  const load = () => {
    void propertyQuery.reload();
    void rentersQuery.reload();
  };
  const [editing, setEditing] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState<{ userId: string; name: string } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(property?.name ?? "Property");


  if (error?.status === 404) return <NoAccess message="This property doesn't exist or isn't assigned to you." />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!property) return <Spinner label="Loading property…" />;

  async function revoke() {
    if (!revoking || !property) return;
    setBusy(true);
    try {
      setProperty(await propertiesApi.revoke(property.id, revoking.userId));
      notify(`${revoking.name} no longer has access to ${property.name}.`, "success");
      setRevoking(null);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not remove access.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!property) return;
    setBusy(true);
    try {
      setProperty(await propertiesApi.archive(property.id));
      notify("Property archived. Its tenancies and documents are kept.", "success");
      setArchiving(false);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not archive the property.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        back={{ to: "/properties", label: "Properties" }}
        title={property.name}
        subtitle={[PROPERTY_TYPE_LABELS[property.property_type], property.address].filter(Boolean).join(" · ")}
        actions={
          <>
            <PropertyStatusBadge status={property.status} />
            {can("renters.manage") && property.status === "active" && (
              <ButtonLink to={`/tenants/new?property=${property.id}`} icon={Plus} variant="secondary">
                Add tenant
              </ButtonLink>
            )}
            {isManager && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {isManager && property.status !== "archived" && (
              <Button variant="ghost" icon={Archive} onClick={() => setArchiving(true)}>
                Archive
              </Button>
            )}
          </>
        }
      />

      <div className="page-grid page-grid--wide-left">
        <div className="stack">
          <Card>
            <CardHeader
              title="Units"
              description={property.unit_count ? `${property.occupied_unit_count} of ${property.unit_count} occupied` : "Add units for apartments, rooms or offices."}
              action={
                isManager && property.status !== "archived" && (
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddingUnit(true)}>
                    Add unit
                  </Button>
                )
              }
            />
            {property.units.length === 0 ? (
              <p className="muted-text">This property has no units; tenancies can cover the whole property.</p>
            ) : (
              <ul className="member-list">
                {property.units.map((u) => (
                  <li key={u.id}>
                    <span>
                      <strong>{u.label}</strong>
                      <span className="muted-text">
                        {" "}
                        · {UNIT_TYPE_LABELS[u.unit_type]}
                        {u.default_rent_cents ? ` · usual rent ${formatAmount(u.default_rent_cents)}` : ""}
                      </span>
                    </span>
                    <span className="badge-row">
                      {u.status !== "active" && <PropertyStatusBadge status={u.status} />}
                      <span className={u.occupied ? "badge badge--success" : "badge badge--neutral"}>{u.occupied ? "Occupied" : "Vacant"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can("renters.manage") && (
            <Card>
              <CardHeader title="Tenants" description="Everyone with a tenancy on this property, current or past." />
              {renters.length === 0 ? (
                <EmptyState icon={Home} title="No tenants yet" />
              ) : (
                <ul className="member-list">
                  {renters.map((r) => (
                    <li key={r.id}>
                      <span>
                        <Link className="table-link" to={`/tenants/${r.id}`}>
                          {r.customer.name}
                        </Link>
                        <span className="muted-text">
                          {" "}
                          {r.current_tenancies
                            .filter((t) => t.property_id === property.id)
                            .map((t) => t.unit_label ?? "Whole property")
                            .join(", ")}
                        </span>
                      </span>
                      <span className="badge-row">
                        <RenterStatusBadge status={r.status} />
                        <KycStatusBadge status={r.kyc_status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="stack">
          <Card>
            <CardHeader
              title="Staff with access"
              description="Only these staff members can see this property and its tenants."
              action={
                isManager && property.status !== "archived" && (
                  <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setAssigning(true)}>
                    Assign
                  </Button>
                )
              }
            />
            {property.assigned_staff.length === 0 ? (
              <p className="muted-text">No staff assigned. Owners and admins always have access.</p>
            ) : (
              <ul className="member-list">
                {property.assigned_staff.map((s) => (
                  <li key={s.user_id}>
                    <span>
                      {isManager ? (
                        <Link className="table-link" to={`/team/${s.user_id}`}>
                          {s.full_name}
                        </Link>
                      ) : (
                        <strong>{s.full_name}</strong>
                      )}
                      <span className="muted-text">
                        {" "}
                        · since {formatDate(s.assigned_at)}
                        {!s.is_active && " · deactivated"}
                      </span>
                    </span>
                    {isManager && (
                      <Button size="sm" variant="ghost" icon={UserMinus} onClick={() => setRevoking({ userId: s.user_id, name: s.full_name })}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {(property.location || property.description) && (
            <Card>
              <CardHeader title="About" />
              <dl className="definition-list">
                {property.location && (
                  <div>
                    <dt>Location</dt>
                    <dd>{property.location}</dd>
                  </div>
                )}
                {property.description && (
                  <div>
                    <dt>Description</dt>
                    <dd className="pre-wrap">{property.description}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>

      {editing && (
        <PropertyModal
          existing={property}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setProperty(p);
            setEditing(false);
            notify("Property updated.", "success");
          }}
        />
      )}
      {addingUnit && (
        <UnitModal
          propertyId={property.id}
          onClose={() => setAddingUnit(false)}
          onSaved={() => {
            setAddingUnit(false);
            notify("Unit added.", "success");
            load();
          }}
        />
      )}
      {assigning && (
        <AssignModal
          property={property}
          onClose={() => setAssigning(false)}
          onAssigned={(p, name) => {
            setProperty(p);
            setAssigning(false);
            notify(`${name} can now manage ${p.name}.`, "success");
          }}
        />
      )}
      {revoking && (
        <ConfirmDialog
          title={`Remove ${revoking.name}?`}
          description={`They lose access to ${property.name} and its tenants immediately. Receipts and records they created are kept.`}
          confirmLabel="Remove access"
          tone="danger"
          isLoading={busy}
          onConfirm={revoke}
          onCancel={() => setRevoking(null)}
        />
      )}
      {archiving && (
        <ConfirmDialog
          title="Archive this property?"
          description="It's hidden from active lists and can't get new tenancies or staff. Existing tenancies, receipts and history are kept."
          confirmLabel="Archive property"
          tone="danger"
          isLoading={busy}
          onConfirm={archive}
          onCancel={() => setArchiving(false)}
        />
      )}
    </div>
  );
}

function UnitModal({ propertyId, onClose, onSaved }: { propertyId: string; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<UnitType>("apartment");
  const [rent, setRent] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!label.trim()) {
      setLabelError("Give the unit a label, e.g. A1.");
      return;
    }
    setBusy(true);
    try {
      await propertiesApi.createUnit(propertyId, { label: label.trim(), unit_type: type, default_rent_cents: rent ? centsFromInput(rent) : null });
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add the unit.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add unit" onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Label" htmlFor="unit_label" required error={labelError ?? undefined}>
          <Input id="unit_label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. A1 or Shop 3" />
        </Field>
        <Field label="Type" htmlFor="unit_type">
          <Select id="unit_type" value={type} onChange={(e) => setType(e.target.value as UnitType)}>
            {(Object.entries(UNIT_TYPE_LABELS) as [UnitType, string][]).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Usual rent (optional)" htmlFor="unit_rent" hint="Pre-fills new tenancies for this unit.">
          <Input id="unit_rent" type="number" inputMode="decimal" min="0" step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Add unit
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({
  property,
  onClose,
  onAssigned,
}: {
  property: PropertyDetail;
  onClose: () => void;
  onAssigned: (p: PropertyDetail, name: string) => void;
}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [userId, setUserId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const assigned = new Set(property.assigned_staff.map((s) => s.user_id));
    teamApi
      .list()
      .then((all) => setMembers(all.filter((m) => m.role !== "owner" && m.is_active && !assigned.has(m.id))))
      .catch((err) => setFormError(err instanceof ApiError ? err.message : "Could not load your team."));
  }, [property]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!userId) return setFormError("Choose a team member.");
    setBusy(true);
    try {
      const name = members?.find((m) => m.id === userId)?.full_name ?? "They";
      onAssigned(await propertiesApi.assign(property.id, userId), name);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not assign the property.");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Assign staff to ${property.name}`} description="They'll be able to manage this property's tenants and documents." onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        {members === null ? (
          <Spinner label="Loading team…" />
        ) : members.length === 0 ? (
          <Alert tone="info">
            Everyone active on your team already has access. <Link to="/team">Add a team member</Link> first.
          </Alert>
        ) : (
          <Field label="Team member" htmlFor="assign_user">
            <Select id="assign_user" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={!members?.length}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
