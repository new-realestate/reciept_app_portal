import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Eye, PenLine, Save, Trash2, Undo2, Upload } from "lucide-react";
import { tenantApi } from "../api/tenant";
import { usersApi } from "../api/users";
import { useAuth } from "../auth/AuthContext";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "../auth/permissions";
import { ApiError } from "../lib/apiClient";
import type { Me } from "../lib/types";
import { Alert, Badge, Button, Card, CardHeader, ErrorState, PageHeader, SegmentedControl, Skeleton } from "../components/ui/ui";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { SignaturePad, type SignaturePadHandle } from "../components/SignaturePad";
import { useToast } from "../components/ToastContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type SignatureMode = "draw" | "upload";

const SAVED_MESSAGE = "Signature saved. It appears on receipts you issue from now on.";

export function ProfilePage() {
  useDocumentTitle("Profile");
  const { session } = useAuth();
  const { notify } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<SignatureMode>("draw");
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMe(await usersApi.me());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load your signature.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Free the preview image when the dialog closes or is replaced.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  if (!session) return null;
  const signatureUrl = me?.signature_image_url ?? null;

  function handleStrokesChange(count: number) {
    setStrokeCount(count);
    if (count > 0) setDrawError(null);
  }

  /** The drawn signature as a PNG, or null (with a message shown) when there's nothing usable yet. */
  async function drawnSignature(): Promise<Blob | null> {
    if (!padRef.current?.hasSignature()) {
      setDrawError("Sign your name in the box first. A dot or a short line isn't enough.");
      return null;
    }
    const blob = await padRef.current.toPngBlob();
    if (!blob) setDrawError("Could not read your drawing. Clear the box and try again.");
    return blob;
  }

  async function saveSignature(blob: Blob) {
    setIsSaving(true);
    try {
      const res = await tenantApi.uploadSignature(new File([blob], "signature.png", { type: "image/png" }));
      setMe((prev) => (prev ? { ...prev, signature_image_url: res.signature_image_url } : prev));
      padRef.current?.clear();
      setPreview(null);
      notify(SAVED_MESSAGE, "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save the signature.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const blob = await drawnSignature();
    if (blob) await saveSignature(blob);
  }

  async function handlePreview() {
    const blob = await drawnSignature();
    if (blob) setPreview({ url: URL.createObjectURL(blob), blob });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await tenantApi.uploadSignature(file);
      setMe((prev) => (prev ? { ...prev, signature_image_url: res.signature_image_url } : prev));
      notify(SAVED_MESSAGE, "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not upload the signature.", "error");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await usersApi.deleteSignature();
      setMe((prev) => (prev ? { ...prev, signature_image_url: null } : prev));
      notify("Signature removed. New receipts won't show a signature.", "success");
      setConfirmRemove(false);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not remove the signature.", "error");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your role, and the signature printed on receipts you issue." />

      <div className="page-grid">
        <Card>
          <CardHeader title="Account" />
          <dl className="definition-list">
            {me && (
              <div>
                <dt>Name</dt>
                <dd>{me.full_name}</dd>
              </div>
            )}
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

          {loadError ? (
            <ErrorState message={loadError} onRetry={load} />
          ) : !me ? (
            <div className="image-preview image-preview--paper" aria-busy="true">
              <Skeleton width="50%" />
            </div>
          ) : (
            <>
              <div className="image-preview image-preview--paper">
                {signatureUrl ? (
                  <img src={signatureUrl} alt="Your current signature" />
                ) : (
                  <span>
                    <PenLine size={16} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />
                    No signature yet
                  </span>
                )}
              </div>
              {signatureUrl && (
                <div className="row-actions" style={{ marginBottom: "var(--space-5)" }}>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmRemove(true)}>
                    Remove signature
                  </Button>
                </div>
              )}

              <div className="stack">
                <SegmentedControl
                  label="How to add your signature"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "draw", label: "Draw" },
                    { value: "upload", label: "Upload image" },
                  ]}
                />

                {mode === "draw" ? (
                  <div>
                    <SignaturePad ref={padRef} onChange={handleStrokesChange} describedBy="signature-pad-help" />
                    <p id="signature-pad-help" className="muted-text" style={{ marginBottom: "var(--space-3)" }}>
                      Use your mouse, finger or a stylus. Can't draw? Choose Upload image instead.
                    </p>
                    {drawError && <Alert tone="error">{drawError}</Alert>}
                    <div className="row-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Undo2}
                        onClick={() => padRef.current?.undo()}
                        disabled={strokeCount === 0 || isSaving}
                      >
                        Undo
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eraser}
                        onClick={() => {
                          padRef.current?.clear();
                          setDrawError(null);
                        }}
                        disabled={strokeCount === 0 || isSaving}
                      >
                        Clear
                      </Button>
                      <Button variant="secondary" size="sm" icon={Eye} onClick={handlePreview} disabled={isSaving}>
                        Preview
                      </Button>
                      <Button size="sm" icon={Save} onClick={handleSave} isLoading={isSaving && !preview}>
                        {signatureUrl ? "Save new signature" : "Save signature"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
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
                        {signatureUrl ? "Replace with an image" : "Upload signature image"}
                      </Button>
                      <span id="signature-help" className="muted-text">
                        PNG, JPG or WebP, up to 5 MB. A transparent PNG looks best.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {preview && (
        <Modal
          title="Preview your signature"
          description="This is how it will appear on the receipts you issue."
          onClose={() => setPreview(null)}
        >
          <div className="signature-preview-paper">
            <figure>
              <img src={preview.url} alt="Preview of your drawn signature" />
              <figcaption>{me?.full_name ?? "Your name"}</figcaption>
            </figure>
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={isSaving}>
              Keep editing
            </Button>
            <Button icon={Save} onClick={() => saveSignature(preview.blob)} isLoading={isSaving}>
              Save signature
            </Button>
          </div>
        </Modal>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove your signature?"
          description="Receipts you issue from now on won't show a signature. Receipts already issued keep theirs."
          confirmLabel="Remove signature"
          tone="danger"
          isLoading={isRemoving}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
