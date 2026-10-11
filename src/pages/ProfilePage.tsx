import { useRef, useState } from "react";
import { PenLine, Upload } from "lucide-react";
import { tenantApi } from "../api/tenant";
import { useAuth } from "../auth/AuthContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import { Badge, Button, Card, CardHeader, PageHeader } from "../components/ui/ui";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

// The API has no "get my signature" endpoint, so remember the last uploaded
// URL in this browser purely so the preview survives a page reload.
function signatureStorageKey(userId: string) {
  return `receipt_portal_signature_${userId}`;
}

function readStoredSignature(userId: string): string | null {
  try {
    return window.localStorage.getItem(signatureStorageKey(userId));
  } catch {
    return null;
  }
}

export function ProfilePage() {
  useDocumentTitle("Profile");
  const { session } = useAuth();
  const { notify } = useToast();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(() =>
    session ? readStoredSignature(session.userId) : null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) return null;
  const userId = session.userId;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await tenantApi.uploadSignature(file);
      setSignatureUrl(res.signature_image_url);
      try {
        window.localStorage.setItem(signatureStorageKey(userId), res.signature_image_url);
      } catch {
        // Preview just won't persist across reloads.
      }
      notify("Signature updated. It appears on receipts you issue from now on.", "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not upload the signature.", "error");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your role, and the signature printed on receipts you issue." />

      <div className="page-grid">
        <Card>
          <CardHeader title="Account" />
          <dl className="definition-list">
            <div>
              <dt>Role</dt>
              <dd>
                <Badge tone="info">{ROLE_LABELS[session.role]}</Badge>
              </dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{ROLE_DESCRIPTIONS[session.role]}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Signature"
            description="Printed on every receipt you issue from now on. Existing receipts keep the signature they were issued with."
          />
          <div className="image-preview">
            {signatureUrl ? (
              <img src={signatureUrl} alt="Your current signature" />
            ) : (
              <span>
                <PenLine size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />
                No signature uploaded in this browser yet
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            hidden
            id="signature-file"
            aria-describedby="signature-help"
          />
          <div className="row-actions">
            <Button variant="secondary" icon={Upload} isLoading={isUploading} onClick={() => fileRef.current?.click()}>
              {signatureUrl ? "Replace signature" : "Upload signature"}
            </Button>
            <span id="signature-help" className="muted-text">
              PNG, JPG or WebP, up to 5 MB.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
