import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail, Plus, Power, PowerOff, UserPlus, Users } from "lucide-react";
import { kycApi } from "../api/kyc";
import { teamApi } from "../api/team";
import { useAccess } from "../auth/AccessContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import { formatDate, formatDateTime } from "../lib/format";
import { PERMISSION_LABELS, type Assignment, type PermissionCatalog, type TeamMember } from "../lib/propertyTypes";
import type { Permission } from "../lib/types";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, PageHeader, Select, Spinner } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { KycStatusBadge } from "../components/ui/StatusBadge";
import { KycPanel } from "../components/kyc/KycPanel";
import { NoAccess } from "../components/RequirePerm";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

function StatusCell({ m }: { m: TeamMember }) {
  return m.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Deactivated</Badge>;
}

const COLUMNS: Column<TeamMember>[] = [
  {
    key: "name",
    header: "Name",
    cell: (m) => (
      <Link className="table-link" to={`/team/${m.id}`}>
        {m.full_name}
      </Link>
    ),
    sortValue: (m) => m.full_name.toLowerCase(),
  },
  { key: "email", header: "Email", cell: (m) => m.email },
  { key: "role", header: "Role", cell: (m) => ROLE_LABELS[m.role], sortValue: (m) => m.role },
  {
    key: "props",
    header: "Properties",
    cell: (m) => (m.role === "owner" || m.role === "admin" ? "All" : m.assigned_property_ids.length),
    align: "end",
  },
  { key: "kyc", header: "KYC", cell: (m) => <KycStatusBadge status={m.kyc_status} /> },
  { key: "status", header: "Status", cell: (m) => <StatusCell m={m} /> },
];

/* ------------------------------------------------------------------ list */

export function TeamPage() {
  useDocumentTitle("Team");
  const { notify } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMembers(await teamApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your team.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Staff work only on the properties you assign them, within the permissions you set."
        actions={
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            Add team member
          </Button>
        }
      />
      <Card flush>
        <DataTable
          caption="Team members"
          columns={COLUMNS}
          rows={members}
          rowKey={(m) => m.id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="members"
          empty={<EmptyState icon={Users} title="It's just you so far" description="Add staff to help manage properties and issue documents." />}
        />
      </Card>
      {adding && (
        <AddMemberModal
          onClose={() => setAdding(false)}
          onCreated={(m) => {
            setAdding(false);
            notify(`Invitation sent to ${m.email}.`, "success");
            load();
          }}
        />
      )}
    </div>
  );
}

function PermissionCheckboxes({
  catalog,
  value,
  onChange,
  disabled,
}: {
  catalog: PermissionCatalog;
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="stack" disabled={disabled}>
      <legend className="field-label">Permissions</legend>
      <div className="permission-grid">
        {catalog.all.map((perm) => (
          <label key={perm} className="checkbox-row">
            <input
              type="checkbox"
              checked={value.includes(perm)}
              onChange={(e) => onChange(e.target.checked ? [...value, perm] : value.filter((p) => p !== perm))}
            />
            <span>
              {PERMISSION_LABELS[perm]?.label ?? perm}
              <small>{PERMISSION_LABELS[perm]?.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AddMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: TeamMember) => void }) {
  const { me } = useAccess();
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [perms, setPerms] = useState<Permission[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    teamApi
      .permissions()
      .then((c) => {
        setCatalog(c);
        setPerms(c.staff_defaults);
      })
      .catch(() => setFormError("Could not load the permission list."));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return document.getElementById(next.name ? "member_name" : "member_email")?.focus();
    setBusy(true);
    try {
      onCreated(
        await teamApi.create({
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role,
          permissions: role === "staff" ? perms : undefined,
        }),
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add the team member.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add team member" description="They'll get an email with a link to set their password." onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Full name" htmlFor="member_name" required error={errors.name}>
          <Input id="member_name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="member_email" required error={errors.email}>
          <Input id="member_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="member_phone">
          <Input id="member_phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="member_role" hint={ROLE_DESCRIPTIONS[role]}>
          <Select id="member_role" value={role} onChange={(e) => setRole(e.target.value as "staff" | "admin")}>
            <option value="staff">Staff</option>
            {me.role === "owner" && <option value="admin">Admin</option>}
          </Select>
        </Field>
        {role === "staff" && catalog && <PermissionCheckboxes catalog={catalog} value={perms} onChange={setPerms} />}
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={Mail} isLoading={busy}>
            Send invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ member */

export function TeamMemberPage() {
  const { memberId = "" } = useParams();
  const { me } = useAccess();
  const { notify } = useToast();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [confirm, setConfirm] = useState<"deactivate" | "reactivate" | "role" | null>(null);
  const [busy, setBusy] = useState(false);
  useDocumentTitle(member?.full_name ?? "Team member");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [m, a] = await Promise.all([teamApi.get(memberId), teamApi.assignments(memberId)]);
      setMember(m);
      setPerms(m.permissions);
      setAssignments(a);
    } catch (err) {
      setError(err instanceof ApiError ? { message: err.message, status: err.status } : { message: "Could not load this member.", status: 0 });
    }
  }, [memberId]);

  useEffect(() => {
    load();
    teamApi.permissions().then(setCatalog).catch(() => undefined);
  }, [load]);

  const loadKyc = useCallback(() => kycApi.forMember(memberId), [memberId]);

  if (error?.status === 404) return <NoAccess message="This team member doesn't exist in your business." />;
  if (error) return <ErrorState message={error.message} onRetry={load} />;
  if (!member) return <Spinner label="Loading…" />;

  const isSelf = member.id === me.id;
  const editable = !isSelf && member.role !== "owner" && (member.role === "staff" || me.role === "owner");
  const permsChanged = [...perms].sort().join() !== [...member.permissions].sort().join();

  async function act(action: () => Promise<TeamMember>, message: string) {
    setBusy(true);
    try {
      const m = await action();
      setMember(m);
      setPerms(m.permissions);
      notify(message, "success");
      setConfirm(null);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "That didn't work. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite() {
    try {
      await teamApi.resendInvite(member!.id);
      notify(`A new set-password link was sent to ${member!.email}.`, "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not send the link.", "error");
    }
  }

  const newRole = member.role === "staff" ? "admin" : "staff";

  return (
    <div>
      <PageHeader
        back={{ to: "/team", label: "Team" }}
        title={member.full_name}
        subtitle={`${ROLE_LABELS[member.role]} · ${member.email}`}
        actions={
          <>
            <StatusCell m={member} />
            {editable && member.is_active && (
              <Button variant="secondary" icon={Mail} onClick={resendInvite}>
                Resend invite
              </Button>
            )}
            {editable &&
              (member.is_active ? (
                <Button variant="danger" icon={PowerOff} onClick={() => setConfirm("deactivate")}>
                  Deactivate
                </Button>
              ) : (
                <Button icon={Power} onClick={() => setConfirm("reactivate")}>
                  Reactivate
                </Button>
              ))}
          </>
        }
      />

      {isSelf && <Alert tone="info">This is you. Your own role and access can only be changed by the business owner.</Alert>}

      <div className="page-grid page-grid--wide-left">
        <div className="stack">
          <Card>
            <CardHeader
              title="Role and permissions"
              action={
                editable &&
                me.role === "owner" && (
                  <Button size="sm" variant="secondary" onClick={() => setConfirm("role")}>
                    Make {ROLE_LABELS[newRole].toLowerCase()}
                  </Button>
                )
              }
            />
            <p className="muted-text">{ROLE_DESCRIPTIONS[member.role]}</p>
            {member.role === "staff" && catalog && (
              <>
                <PermissionCheckboxes catalog={catalog} value={perms} onChange={setPerms} disabled={!editable} />
                {editable && (
                  <div className="action-bar">
                    {!member.uses_default_permissions && (
                      <Button variant="ghost" onClick={() => act(() => teamApi.update(member.id, { reset_permissions: true }), "Permissions reset to the defaults.")}>
                        Reset to defaults
                      </Button>
                    )}
                    <Button disabled={!permsChanged} isLoading={busy} onClick={() => act(() => teamApi.update(member.id, { permissions: perms }), "Permissions updated.")}>
                      Save permissions
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>

          {member.role !== "owner" && <KycPanel load={loadKyc} />}
        </div>

        <Card>
          <CardHeader title="Property access" description="Assign or remove properties from each property's page." />
          {member.role !== "staff" ? (
            <p className="muted-text">Owners and admins can manage every property.</p>
          ) : assignments.length === 0 ? (
            <EmptyState icon={Plus} title="No properties assigned" description="Open a property and use Assign to give access." />
          ) : (
            <ul className="member-list">
              {assignments.map((a) => (
                <li key={a.id}>
                  <span>
                    <Link className="table-link" to={`/properties/${a.property_id}`}>
                      {a.property_name}
                    </Link>
                    <span className="muted-text">
                      {" "}
                      · from {formatDate(a.assigned_at)}
                      {a.revoked_at ? ` to ${formatDate(a.revoked_at)}` : ""}
                    </span>
                  </span>
                  {a.active ? <Badge tone="success">Current</Badge> : <Badge tone="neutral">Removed</Badge>}
                </li>
              ))}
            </ul>
          )}
          {member.last_login_at && <p className="muted-text">Last signed in {formatDateTime(member.last_login_at)}.</p>}
        </Card>
      </div>

      {confirm === "deactivate" && (
        <ConfirmDialog
          title={`Deactivate ${member.full_name}?`}
          description="They're signed out and can't use the portal from their next action. Their receipts and history stay; property assignments are kept for when you reactivate them."
          confirmLabel="Deactivate"
          tone="danger"
          isLoading={busy}
          onConfirm={() => act(() => teamApi.deactivate(member.id), `${member.full_name} has been deactivated.`)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "reactivate" && (
        <ConfirmDialog
          title={`Reactivate ${member.full_name}?`}
          description="They can sign in again with their existing password and regain their property access."
          confirmLabel="Reactivate"
          isLoading={busy}
          onConfirm={() => act(() => teamApi.reactivate(member.id), `${member.full_name} is active again.`)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "role" && (
        <ConfirmDialog
          title={`Make ${member.full_name} ${newRole === "admin" ? "an admin" : "staff"}?`}
          description={
            newRole === "admin"
              ? "Admins manage the whole business: every property, staff, settings and the audit log."
              : "They'll keep only the properties assigned to them and the default staff permissions."
          }
          confirmLabel={`Make ${ROLE_LABELS[newRole].toLowerCase()}`}
          tone={newRole === "admin" ? "danger" : "primary"}
          isLoading={busy}
          onConfirm={() => act(() => teamApi.update(member.id, { role: newRole }), "Role changed.")}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
