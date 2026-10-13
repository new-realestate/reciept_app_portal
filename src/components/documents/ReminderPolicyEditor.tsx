import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/apiClient";
import { Alert, Button, Field, Input, Select } from "../ui/ui";
import { useToast } from "../ToastContext";

export interface PolicyBody {
  enabled?: boolean;
  offsets?: number[];
  channels?: string[];
  send_hour?: number;
  notify_business?: boolean;
}

const DEFAULT_OFFSETS = [-3, 0, 3];

function parseOffsets(text: string): number[] | string {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Add at least one reminder day, or turn reminders off.";
  if (parts.length > 10) return "Use at most 10 reminder days.";
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return "Use whole numbers separated by commas, e.g. -3, 0, 3.";
  if (nums.some((n) => n < -90 || n > 365)) return "Days must be between -90 and 365.";
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function describeOffset(n: number): string {
  if (n === 0) return "on the due date";
  return n < 0 ? `${-n} day${n === -1 ? "" : "s"} before` : `${n} day${n === 1 ? "" : "s"} after`;
}

/**
 * Edits when reminders go out relative to a due date: negative days are before it,
 * 0 is the due date, positive days are overdue follow-ups.
 */
export function ReminderPolicyEditor({
  enabled,
  overrides,
  onSave,
  showNotifyBusiness,
  notifyBusiness = false,
  idPrefix = "rp",
}: {
  enabled: boolean;
  overrides: Record<string, unknown> | null;
  onSave: (body: PolicyBody) => Promise<void>;
  showNotifyBusiness?: boolean;
  notifyBusiness?: boolean;
  idPrefix?: string;
}) {
  const { notify } = useToast();
  const initialOffsets = (overrides?.offsets as number[] | undefined) ?? DEFAULT_OFFSETS;
  const initialChannels = (overrides?.channels as string[] | undefined) ?? ["email", "sms"];
  const [on, setOn] = useState(enabled);
  const [offsets, setOffsets] = useState(initialOffsets.join(", "));
  const [email, setEmail] = useState(initialChannels.includes("email"));
  const [sms, setSms] = useState(initialChannels.includes("sms"));
  const [hour, setHour] = useState(String((overrides?.send_hour as number | undefined) ?? 9));
  const [business, setBusiness] = useState(notifyBusiness);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseOffsets(offsets);
    if (typeof parsed === "string" && on) return setError(parsed);
    const channels = [...(email ? ["email"] : []), ...(sms ? ["sms"] : [])];
    if (on && channels.length === 0) return setError("Choose at least one channel.");
    setBusy(true);
    try {
      await onSave({
        enabled: on,
        ...(Array.isArray(parsed) ? { offsets: parsed } : {}),
        channels: channels.length ? channels : undefined,
        send_hour: Number(hour),
        ...(showNotifyBusiness ? { notify_business: business } : {}),
      });
      notify("Reminder settings saved.", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the settings.");
    } finally {
      setBusy(false);
    }
  }

  const parsedPreview = parseOffsets(offsets);

  return (
    <form onSubmit={submit} noValidate>
      <div className="stack">
        {error && <Alert tone="error">{error}</Alert>}
        <label className="checkbox-row">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
          <span>Send automatic reminders</span>
        </label>
        <fieldset className="stack" disabled={!on}>
          <Field
            label="Reminder days"
            htmlFor={`${idPrefix}-offsets`}
            hint="Days relative to the due date, separated by commas. Negative = before, 0 = due date, positive = overdue follow-up."
          >
            <Input id={`${idPrefix}-offsets`} value={offsets} onChange={(e) => setOffsets(e.target.value)} placeholder="-3, 0, 3" />
          </Field>
          {Array.isArray(parsedPreview) && (
            <p className="muted-text" aria-live="polite">
              Reminders go out {parsedPreview.map(describeOffset).join(", ")}.
            </p>
          )}
          <div className="form-grid">
            <Field label="Time of day" htmlFor={`${idPrefix}-hour`} hint="In your business timezone.">
              <Select id={`${idPrefix}-hour`} value={hour} onChange={(e) => setHour(e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                ))}
              </Select>
            </Field>
            <div className="field">
              <span className="field-label">Channels</span>
              <label className="checkbox-row"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /><span>Email</span></label>
              <label className="checkbox-row"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /><span>SMS</span></label>
            </div>
          </div>
          {showNotifyBusiness && (
            <label className="checkbox-row">
              <input type="checkbox" checked={business} onChange={(e) => setBusiness(e.target.checked)} />
              <span>Also email me when a payment is due today or overdue<small>Sent to your business contact email.</small></span>
            </label>
          )}
        </fieldset>
        <div>
          <Button type="submit" isLoading={busy}>Save reminder settings</Button>
        </div>
      </div>
    </form>
  );
}
