import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, FileUp, PencilLine, Send, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { kycApi } from "../../api/kyc";
import { useAccess } from "../../auth/AccessContext";
import { ApiError } from "../../lib/apiClient";
import { formatDate, formatDateTime } from "../../lib/format";
import {
  ID_DOCUMENT_LABELS,
  KYC_DOCUMENT_LABELS,
  type IdDocumentType,
  type KycDecision,
  type KycDocument,
  type KycDocumentKind,
  type KycProfile,
  type KycProfileUpdate,
} from "../../lib/propertyTypes";
import { Alert, Button, Card, CardHeader, ErrorState, Field, Input, Select, Spinner, Textarea } from "../ui/ui";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { KycStatusBadge } from "../ui/StatusBadge";
import { useToast } from "../ToastContext";

const MAX_UPLOAD_MB = 10;

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * One KYC profile: details (ID number masked), documents, submission and review.
 * What the viewer may do comes from the profile's can_* flags, which the API computes.
 */
export function KycPanel({ load, title = "Identity verification (KYC)" }: { load: () => Promise<KycProfile>; title?: string }) {
  const { notify } = useToast();
  const { isManager } = useAccess();
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [decision, setDecision] = useState<KycDecision | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ doc: KycDocument; objectUrl: string | null; error: string | null } | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setProfile(await load());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load KYC details.");
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error) return <Card><ErrorState message={error} onRetry={reload} /></Card>;
  if (!profile) return <Card><Spinner label="Loading KYC…" /></Card>;

  async function run(action: () => Promise<KycProfile>, success: string) {
    setBusy(true);
    try {
      setProfile(await action());
      notify(success, "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "That didn't work. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(doc: KycDocument) {
    // Fetch through the short-lived, audited link and show it here: no pop-up for the browser to block.
    setViewing({ doc, objectUrl: null, error: null });
    try {
      const { url } = await kycApi.downloadUrl(doc.id);
      const response = await fetch(url);
      if (!response.ok) throw new Error("The document couldn't be loaded. The link may have expired; try again.");
      const objectUrl = URL.createObjectURL(await response.blob());
      setViewing((v) => (v?.doc.id === doc.id ? { doc, objectUrl, error: null } : (URL.revokeObjectURL(objectUrl), v)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open the document.";
      setViewing((v) => (v?.doc.id === doc.id ? { doc, objectUrl: null, error: message } : v));
    }
  }

  function closeViewer() {
    if (viewing?.objectUrl) URL.revokeObjectURL(viewing.objectUrl);
    setViewing(null);
  }

  async function reveal() {
    try {
      setRevealed((await kycApi.revealIdNumber(profile!.id)).id_number);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not show the ID number.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await kycApi.deleteDocument(deleting);
      setDeleting(null);
      notify("Document deleted.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete the document.", "error");
    } finally {
      setBusy(false);
    }
  }

  const needsAttention = profile.status === "rejected" || profile.status === "requires_correction";
  const canUpload = profile.can_edit && (profile.status !== "pending_review" || isManager);

  return (
    <Card>
      <CardHeader
        title={title}
        description="Checked manually by a reviewer. Uploading a document doesn't by itself verify it."
        action={<KycStatusBadge status={profile.status} />}
      />
      <div className="stack">
        {needsAttention && profile.review_note && (
          <Alert tone={profile.status === "rejected" ? "error" : "warning"}>
            <strong>Reviewer's note:</strong> {profile.review_note}
          </Alert>
        )}
        {profile.status === "expired" && <Alert tone="warning">The identity document has expired. Update the details and resubmit.</Alert>}

        <dl className="definition-list">
          <div>
            <dt>Legal name</dt>
            <dd>{profile.legal_name || "—"}</dd>
          </div>
          <div>
            <dt>Date of birth</dt>
            <dd>{profile.date_of_birth ? formatDate(profile.date_of_birth) : "—"}</dd>
          </div>
          <div>
            <dt>ID document</dt>
            <dd>
              {profile.id_document_type ? ID_DOCUMENT_LABELS[profile.id_document_type] : "—"}
              {profile.id_number_masked && (
                <>
                  {" · "}
                  <span className="mono-text">{revealed ?? profile.id_number_masked}</span>
                  {profile.can_review && !revealed && (
                    <Button variant="ghost" size="sm" icon={Eye} onClick={reveal}>
                      Show
                    </Button>
                  )}
                </>
              )}
              {profile.id_expiry_date && <span className="muted-text"> · expires {formatDate(profile.id_expiry_date)}</span>}
            </dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd className="pre-wrap">{profile.residential_address || "—"}</dd>
          </div>
          <div>
            <dt>Emergency contact</dt>
            <dd>
              {profile.emergency_contact_name
                ? [profile.emergency_contact_name, profile.emergency_contact_relationship, profile.emergency_contact_phone].filter(Boolean).join(" · ")
                : "—"}
            </dd>
          </div>
          {profile.subject_type === "staff" && (
            <div>
              <dt>Staff reference</dt>
              <dd>{profile.staff_reference || "—"}</dd>
            </div>
          )}
          {profile.submitted_at && (
            <div>
              <dt>Submitted</dt>
              <dd>{formatDateTime(profile.submitted_at)}</dd>
            </div>
          )}
        </dl>

        <div>
          <h3 className="section-title">Documents</h3>
          {profile.documents.length === 0 ? (
            <p className="muted-text">No documents uploaded yet.</p>
          ) : (
            <ul className="kyc-docs">
              {profile.documents.map((d) => (
                <li key={d.id}>
                  <span>
                    <strong>{KYC_DOCUMENT_LABELS[d.kind]}</strong>
                    <span className="muted-text">
                      {" "}
                      · {fileSize(d.size_bytes)} · uploaded {formatDate(d.uploaded_at)}
                    </span>
                  </span>
                  <span className="row-actions">
                    {profile.can_view_documents && (
                      <Button variant="secondary" size="sm" icon={Eye} onClick={() => openDocument(d)}>
                        View
                      </Button>
                    )}
                    {isManager && (
                      <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(d.id)}>
                        Delete
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!profile.can_view_documents && profile.documents.length > 0 && (
            <p className="muted-text">Only reviewers can open identity documents.</p>
          )}
          {canUpload && <UploadForm profileId={profile.id} onUploaded={reload} />}
        </div>

        <div className="action-bar">
          {profile.can_edit && (
            <Button variant="secondary" icon={PencilLine} onClick={() => setEditing(true)} disabled={busy}>
              Edit details
            </Button>
          )}
          {profile.can_submit && (
            <Button icon={Send} isLoading={busy} onClick={() => run(() => kycApi.submit(profile.id), "Submitted for review.")}>
              Submit for review
            </Button>
          )}
          {profile.can_review && (
            <>
              <Button variant="secondary" icon={ShieldAlert} onClick={() => setDecision("requires_correction")} disabled={busy}>
                Request correction
              </Button>
              <Button variant="danger" icon={XCircle} onClick={() => setDecision("rejected")} disabled={busy}>
                Reject
              </Button>
              <Button icon={CheckCircle2} onClick={() => setDecision("approved")} disabled={busy}>
                Approve
              </Button>
            </>
          )}
        </div>

        {profile.reviews.length > 0 && (
          <div>
            <h3 className="section-title">Review history</h3>
            <ul className="member-list">
              {profile.reviews.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>{{ approved: "Approved", rejected: "Rejected", requires_correction: "Correction requested" }[r.decision]}</strong>
                    {r.note && <span className="muted-text"> — {r.note}</span>}
                  </span>
                  <span className="muted-text">
                    {r.reviewer_name ?? "Reviewer"} · {formatDateTime(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && (
        <EditKycModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setProfile(p);
            setRevealed(null);
            setEditing(false);
            notify("KYC details saved.", "success");
          }}
        />
      )}
      {decision && (
        <ReviewModal
          decision={decision}
          onClose={() => setDecision(null)}
          onSubmit={async (note) => {
            await run(() => kycApi.review(profile.id, decision, note), "Review recorded.");
            setDecision(null);
          }}
        />
      )}
      {viewing && <DocumentViewer viewing={viewing} onClose={closeViewer} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this document?"
          description="The file is removed from storage for good. A record that it existed is kept in the audit history."
          confirmLabel="Delete document"
          tone="danger"
          isLoading={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Card>
  );
}

function DocumentViewer({
  viewing,
  onClose,
}: {
  viewing: { doc: KycDocument; objectUrl: string | null; error: string | null };
  onClose: () => void;
}) {
  const { doc, objectUrl, error } = viewing;
  const isPdf = doc.content_type === "application/pdf";
  const ext = doc.content_type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  return (
    <Modal title={KYC_DOCUMENT_LABELS[doc.kind]} description={`Uploaded ${formatDate(doc.uploaded_at)}. Opening it is recorded in the audit log.`} onClose={onClose}>
      <div className="stack">
        {error ? (
          <Alert tone="error">{error}</Alert>
        ) : !objectUrl ? (
          <Spinner label="Loading document…" />
        ) : isPdf ? (
          <iframe className="kyc-viewer kyc-viewer--pdf" src={objectUrl} title={KYC_DOCUMENT_LABELS[doc.kind]} />
        ) : (
          <img className="kyc-viewer" src={objectUrl} alt={KYC_DOCUMENT_LABELS[doc.kind]} />
        )}
        <div className="modal-footer">
          {objectUrl && (
            <a className="btn btn--secondary" href={objectUrl} download={`${doc.kind}.${ext}`}>
              Download
            </a>
          )}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

function UploadForm({ profileId, onUploaded }: { profileId: string; onUploaded: () => Promise<void> }) {
  const { notify } = useToast();
  const [kind, setKind] = useState<KycDocumentKind>("id_front");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setError(`Files can be up to ${MAX_UPLOAD_MB} MB.`);
    setBusy(true);
    try {
      await kycApi.upload(profileId, kind, file);
      setFile(null);
      setInputKey((k) => k + 1);
      notify("Document uploaded.", "success");
      await onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not upload the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="kyc-upload" onSubmit={upload} noValidate style={{ marginTop: "var(--space-4)" }}>
      <Field label="Document" htmlFor={`kyc_kind_${profileId}`}>
        <Select id={`kyc_kind_${profileId}`} value={kind} onChange={(e) => setKind(e.target.value as KycDocumentKind)}>
          {(Object.entries(KYC_DOCUMENT_LABELS) as [KycDocumentKind, string][]).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="File" htmlFor={`kyc_file_${profileId}`} hint={`PDF, PNG, JPEG or WebP, up to ${MAX_UPLOAD_MB} MB.`} error={error ?? undefined}>
        <Input
          key={inputKey}
          id={`kyc_file_${profileId}`}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Button type="submit" variant="secondary" icon={FileUp} isLoading={busy}>
        Upload
      </Button>
    </form>
  );
}

function EditKycModal({ profile, onClose, onSaved }: { profile: KycProfile; onClose: () => void; onSaved: (p: KycProfile) => void }) {
  const [legalName, setLegalName] = useState(profile.legal_name ?? "");
  const [dob, setDob] = useState(profile.date_of_birth ?? "");
  const [address, setAddress] = useState(profile.residential_address ?? "");
  const [docType, setDocType] = useState<IdDocumentType | "">(profile.id_document_type ?? "");
  const [idNumber, setIdNumber] = useState("");
  const [expiry, setExpiry] = useState(profile.id_expiry_date ?? "");
  const [ecName, setEcName] = useState(profile.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(profile.emergency_contact_phone ?? "");
  const [ecRel, setEcRel] = useState(profile.emergency_contact_relationship ?? "");
  const [staffRef, setStaffRef] = useState(profile.staff_reference ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload: KycProfileUpdate = {
      legal_name: legalName.trim() || null,
      date_of_birth: dob || null,
      residential_address: address.trim() || null,
      id_document_type: docType || null,
      id_expiry_date: expiry || null,
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone.trim() || null,
      emergency_contact_relationship: ecRel.trim() || null,
    };
    if (profile.subject_type === "staff") payload.staff_reference = staffRef.trim() || null;
    if (idNumber.trim()) payload.id_number = idNumber.trim();
    setBusy(true);
    try {
      onSaved(await kycApi.update(profile.id, payload));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the details.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit KYC details"
      description={profile.status === "verified" ? "Changing identity details sends the profile back for review." : undefined}
      onClose={onClose}
    >
      <form className="stack" onSubmit={save} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label="Full legal name" htmlFor="kyc_legal" className="form-grid-full">
            <Input id="kyc_legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </Field>
          <Field label="ID document type" htmlFor="kyc_doctype">
            <Select id="kyc_doctype" value={docType} onChange={(e) => setDocType(e.target.value as IdDocumentType | "")}>
              <option value="">Choose…</option>
              {(Object.entries(ID_DOCUMENT_LABELS) as [IdDocumentType, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="ID number"
            htmlFor="kyc_idnum"
            hint={profile.id_number_masked ? `On file: ${profile.id_number_masked}. Leave blank to keep it.` : "Stored encrypted; only the last 4 characters are shown."}
          >
            <Input id="kyc_idnum" autoComplete="off" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </Field>
          <Field label="ID expiry date" htmlFor="kyc_expiry">
            <Input id="kyc_expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </Field>
          <Field label="Date of birth" htmlFor="kyc_dob" hint="Only where required.">
            <Input id="kyc_dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Residential address" htmlFor="kyc_address" className="form-grid-full">
            <Textarea id="kyc_address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Emergency contact name" htmlFor="kyc_ec_name">
            <Input id="kyc_ec_name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
          </Field>
          <Field label="Emergency contact phone" htmlFor="kyc_ec_phone">
            <Input id="kyc_ec_phone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
          </Field>
          <Field label="Relationship" htmlFor="kyc_ec_rel">
            <Input id="kyc_ec_rel" value={ecRel} onChange={(e) => setEcRel(e.target.value)} />
          </Field>
          {profile.subject_type === "staff" && (
            <Field label="Staff reference" htmlFor="kyc_staffref">
              <Input id="kyc_staffref" value={staffRef} onChange={(e) => setStaffRef(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy}>
            Save details
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({
  decision,
  onClose,
  onSubmit,
}: {
  decision: KycDecision;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = {
    approved: { title: "Approve KYC", label: "Approve", note: "Note (optional)" },
    rejected: { title: "Reject KYC", label: "Reject", note: "Why is it rejected?" },
    requires_correction: { title: "Request a correction", label: "Request correction", note: "What needs to change?" },
  }[decision];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (decision !== "approved" && !note.trim()) return setError("Add a note so they know what to fix.");
    setBusy(true);
    await onSubmit(note.trim());
    setBusy(false);
  }

  return (
    <Modal
      title={copy.title}
      description={decision === "approved" ? "Confirm you've checked the details against the documents." : undefined}
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={copy.note} htmlFor="kyc_review_note" error={error ?? undefined} required={decision !== "approved"}>
          <Textarea id="kyc_review_note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={decision === "rejected" ? "danger" : "primary"} isLoading={busy}>
            {copy.label}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
