import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ImageUp } from "lucide-react";
import { tenantApi } from "../api/tenant";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import { handleRadioGroupKeyDown } from "../lib/a11y";
import type { ReceiptTemplate, Tenant, TenantUpdatePayload } from "../lib/types";
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LockedNotice,
  PageHeader,
  Spinner,
} from "../components/ui/ui";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const TEMPLATE_OPTIONS: { value: ReceiptTemplate; title: string; description: string }[] = [
  { value: "classic", title: "Classic", description: "Traditional letterhead with a ruled details table." },
  { value: "modern", title: "Modern", description: "Accent header, highlighted amount and a clean layout." },
];

type FormState = Required<Omit<TenantUpdatePayload, "receipt_template">>;

function formFromTenant(t: Tenant): FormState {
  return {
    business_name: t.business_name,
    po_box: t.po_box ?? "",
    physical_address: t.physical_address ?? "",
    contact_phone: t.contact_phone ?? "",
    contact_email: t.contact_email ?? "",
    bank_name: t.bank_name ?? "",
    bank_account_number: t.bank_account_number ?? "",
  };
}

export function AdminPortalPage() {
  useDocumentTitle("Business settings");
  const { session } = useAuth();
  const { notify } = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const canEdit = session ? permissions.canEditLetterhead(session.role) : false;
  const canUploadLogo = session ? permissions.canUploadLogo(session.role) : false;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const t = await tenantApi.getMine();
      setTenant(t);
      setForm(formFromTenant(t));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load business settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isDirty =
    tenant && form ? JSON.stringify(form) !== JSON.stringify(formFromTenant(tenant)) : false;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !form) return;
    setIsSaving(true);
    try {
      // An empty contact email would fail the API's email validation, so omit it.
      const payload: TenantUpdatePayload = { ...form, contact_email: form.contact_email || undefined };
      const updated = await tenantApi.update(payload);
      setTenant(updated);
      setForm(formFromTenant(updated));
      notify("Business settings saved. Changes apply to future receipts only.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save changes.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTemplateChange(value: ReceiptTemplate) {
    if (!canEdit || !tenant || value === tenant.receipt_template || isSavingTemplate) return;
    setIsSavingTemplate(true);
    try {
      const updated = await tenantApi.update({ receipt_template: value });
      setTenant((prev) => (prev ? { ...prev, receipt_template: updated.receipt_template } : updated));
      notify("Receipt design updated. It applies to receipts you issue from now on.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not change the receipt design.", "error");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canUploadLogo) return;
    setIsUploadingLogo(true);
    try {
      const res = await tenantApi.uploadLogo(file);
      setTenant((prev) => (prev ? { ...prev, logo_url: res.logo_url } : prev));
      notify("Logo updated.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not upload the logo.", "error");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  if (isLoading && !tenant) {
    return (
      <div className="full-page-center">
        <Spinner label="Loading business settings…" />
      </div>
    );
  }

  if (loadError || !tenant || !form) {
    return (
      <>
        <PageHeader title="Business settings" />
        <Card>
          <ErrorState message={loadError ?? "Business settings could not be loaded."} onRetry={load} />
        </Card>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business settings"
        subtitle="Letterhead, branding and bank details used on every receipt you issue."
      />

      {!canEdit && (
        <div style={{ marginBottom: "var(--space-5)" }}>
          <LockedNotice>
            Your role is read-only here. Only Owners and Admins can change business settings, bank details and the logo.
          </LockedNotice>
        </div>
      )}

      <div className="page-grid page-grid--wide-left">
        <Card>
          <form onSubmit={handleSave}>
            <CardHeader title="Letterhead" description="Shown at the top of every receipt." />
            <div className="form-grid">
              <Field label="Business name" htmlFor="business_name" required className="form-grid-full">
                <Input
                  id="business_name"
                  value={form.business_name}
                  disabled={!canEdit}
                  onChange={(e) => updateField("business_name", e.target.value)}
                />
              </Field>
              <Field label="P.O. Box" htmlFor="po_box">
                <Input id="po_box" value={form.po_box} disabled={!canEdit} onChange={(e) => updateField("po_box", e.target.value)} />
              </Field>
              <Field label="Contact phone" htmlFor="contact_phone">
                <Input
                  id="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  disabled={!canEdit}
                  onChange={(e) => updateField("contact_phone", e.target.value)}
                />
              </Field>
              <Field label="Physical address" htmlFor="physical_address" className="form-grid-full">
                <Input
                  id="physical_address"
                  value={form.physical_address}
                  disabled={!canEdit}
                  onChange={(e) => updateField("physical_address", e.target.value)}
                />
              </Field>
              <Field label="Contact email" htmlFor="contact_email" className="form-grid-full">
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  disabled={!canEdit}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ marginTop: "var(--space-8)" }}>
              <CardHeader title="Bank details" description="Optional. Printed on receipts so payers know where to pay." />
              <div className="form-grid">
                <Field label="Bank name" htmlFor="bank_name">
                  <Input id="bank_name" value={form.bank_name} disabled={!canEdit} onChange={(e) => updateField("bank_name", e.target.value)} />
                </Field>
                <Field label="Account number" htmlFor="bank_account_number">
                  <Input
                    id="bank_account_number"
                    value={form.bank_account_number}
                    disabled={!canEdit}
                    onChange={(e) => updateField("bank_account_number", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {canEdit && (
              <div className="action-bar">
                <span className="action-bar-note" role="status">
                  {isDirty ? "You have unsaved changes" : "All changes saved"}
                </span>
                <Button type="submit" isLoading={isSaving} disabled={!isDirty}>
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </Card>

        <div className="stack">
          <Card>
            <CardHeader title="Logo" description="Appears in the receipt letterhead." />
            <div className="image-preview">
              {tenant.logo_url ? <img src={tenant.logo_url} alt={`${tenant.business_name} logo`} /> : <span>No logo uploaded yet</span>}
            </div>
            {canUploadLogo && (
              <>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  hidden
                  id="logo-file"
                  aria-describedby="logo-help"
                />
                <div className="row-actions">
                  <Button variant="secondary" icon={ImageUp} isLoading={isUploadingLogo} onClick={() => logoInputRef.current?.click()}>
                    {tenant.logo_url ? "Replace logo" : "Upload logo"}
                  </Button>
                  <span id="logo-help" className="muted-text">
                    PNG, JPG or WebP, up to 5 MB.
                  </span>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Receipt design" description="Choose how your receipts look. Applies to new receipts." />
            <div className="template-options" role="radiogroup" aria-label="Receipt design" onKeyDown={handleRadioGroupKeyDown}>
              {TEMPLATE_OPTIONS.map((option) => {
                const selected = tenant.receipt_template === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    disabled={!canEdit || isSavingTemplate}
                    className="template-option"
                    onClick={() => handleTemplateChange(option.value)}
                  >
                    <span className={`template-thumb template-thumb-${option.value}`} aria-hidden="true">
                      <span className="thumb-header" />
                      <span className="thumb-amount" />
                      <span className="thumb-line" />
                      <span className="thumb-line thumb-line-short" />
                    </span>
                    <span className="template-option-title">
                      {option.title}
                      {selected && <Check size={16} aria-hidden />}
                    </span>
                    <span className="template-option-desc">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
