import { useEffect, useRef, useState, type FormEvent } from "react";
import { tenantApi } from "../api/tenant";
import { useAuth } from "../auth/AuthContext";
import { permissions } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import type { Tenant, TenantUpdatePayload } from "../lib/types";
import { Button, Card, Field, Input, LockedNotice, PageHeader, Spinner } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

export function AdminPortalPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<TenantUpdatePayload>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const canEdit = session ? permissions.canEditLetterhead(session.role) : false;
  const canUploadLogo = session ? permissions.canUploadLogo(session.role) : false;

  useEffect(() => {
    tenantApi
      .getMine()
      .then((t) => {
        setTenant(t);
        setForm({
          business_name: t.business_name,
          po_box: t.po_box ?? "",
          physical_address: t.physical_address ?? "",
          contact_phone: t.contact_phone ?? "",
          contact_email: t.contact_email ?? "",
          bank_name: t.bank_name ?? "",
          bank_account_number: t.bank_account_number ?? "",
        });
      })
      .catch((err) => notify(err instanceof ApiError ? err.message : "Could not load business settings.", "error"))
      .finally(() => setIsLoading(false));
  }, [notify]);

  function updateField<K extends keyof TenantUpdatePayload>(key: K, value: TenantUpdatePayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const updated = await tenantApi.update(form);
      setTenant(updated);
      notify("Business settings saved. Changes apply to future receipts only.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save changes.", "error");
    } finally {
      setIsSaving(false);
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
      notify(err instanceof ApiError ? err.message : "Could not upload logo.", "error");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  if (isLoading) {
    return (
      <div className="full-page-center">
        <Spinner label="Loading business settings…" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <Card>
        <p>Business settings could not be loaded.</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Portal"
        subtitle="Letterhead, branding, and bank details used on every receipt you issue."
      />

      {!canEdit && (
        <LockedNotice>
          Your role ({session?.role}) has read-only access here. Only Owner and Admin accounts can edit business
          settings and bank details.
        </LockedNotice>
      )}

      <div className="detail-grid">
        <Card>
          <h2 className="section-title">Logo</h2>
          {tenant.logo_url ? (
            <div className="logo-preview">
              <img src={tenant.logo_url} alt={`${tenant.business_name} logo`} />
            </div>
          ) : (
            <p className="muted-text">No logo uploaded yet.</p>
          )}
          {canUploadLogo ? (
            <>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                hidden
                id="logo-file"
              />
              <Button variant="secondary" isLoading={isUploadingLogo} onClick={() => logoInputRef.current?.click()}>
                {tenant.logo_url ? "Replace logo" : "Upload logo"}
              </Button>
            </>
          ) : (
            <LockedNotice>Logo uploads are restricted to Owner and Admin roles.</LockedNotice>
          )}
        </Card>

        <Card>
          <h2 className="section-title">Letterhead & bank details</h2>
          <form onSubmit={handleSave} className="form-grid">
            <Field label="Business name" htmlFor="business_name" required>
              <Input
                id="business_name"
                value={form.business_name ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("business_name", e.target.value)}
              />
            </Field>
            <Field label="P.O. Box" htmlFor="po_box">
              <Input id="po_box" value={form.po_box ?? ""} disabled={!canEdit} onChange={(e) => updateField("po_box", e.target.value)} />
            </Field>
            <Field label="Physical address" htmlFor="physical_address">
              <Input
                id="physical_address"
                value={form.physical_address ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("physical_address", e.target.value)}
              />
            </Field>
            <Field label="Contact phone" htmlFor="contact_phone">
              <Input
                id="contact_phone"
                value={form.contact_phone ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("contact_phone", e.target.value)}
              />
            </Field>
            <Field label="Contact email" htmlFor="contact_email">
              <Input
                id="contact_email"
                type="email"
                value={form.contact_email ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("contact_email", e.target.value)}
              />
            </Field>
            <Field label="Bank name" htmlFor="bank_name">
              <Input id="bank_name" value={form.bank_name ?? ""} disabled={!canEdit} onChange={(e) => updateField("bank_name", e.target.value)} />
            </Field>
            <Field label="Bank account number" htmlFor="bank_account_number">
              <Input
                id="bank_account_number"
                value={form.bank_account_number ?? ""}
                disabled={!canEdit}
                onChange={(e) => updateField("bank_account_number", e.target.value)}
              />
            </Field>

            {canEdit && (
              <Button type="submit" isLoading={isSaving} className="form-grid-full">
                Save changes
              </Button>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
