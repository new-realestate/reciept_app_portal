import { useRef, useState } from "react";
import { tenantApi } from "../api/tenant";
import { useAuth } from "../auth/AuthContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import { Badge, Button, Card, PageHeader } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";

export function ProfilePage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await tenantApi.uploadSignature(file);
      setSignatureUrl(res.signature_image_url);
      notify("Signature updated. It will appear on receipts you issue from now on.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not upload signature.", "error");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your account, role, and the signature used when you issue receipts." />

      <div className="detail-grid">
        <Card>
          <h2 className="section-title">Account</h2>
          <dl className="definition-list">
            <div>
              <dt>Role</dt>
              <dd>
                <Badge tone="info">{ROLE_LABELS[session.role]}</Badge>
              </dd>
            </div>
            <div>
              <dt>Permissions</dt>
              <dd>{ROLE_DESCRIPTIONS[session.role]}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd className="mono-text">{session.userId}</dd>
            </div>
            <div>
              <dt>Tenant ID</dt>
              <dd className="mono-text">{session.tenantId}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="section-title">Signature</h2>
          <p className="muted-text">
            Uploaded here, this image is snapshotted onto every receipt you issue from now on. Every role can manage their own signature.
          </p>
          {signatureUrl && (
            <div className="signature-preview">
              <img src={signatureUrl} alt="Your signature" />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} hidden id="signature-file" />
          <Button variant="secondary" isLoading={isUploading} onClick={() => fileRef.current?.click()}>
            {signatureUrl ? "Replace signature" : "Upload signature"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
