import { useMemo, useState, type CSSProperties } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { buildBusinessTheme, HEX_COLOR } from "../lib/brandTheme";
import { Alert, Button, Card, CardHeader, Field, Input } from "./ui/ui";

const DEFAULT_COLOR = "#3b3fd1";
const SWATCHES = ["#3b3fd1", "#1f7a5c", "#0e7490", "#b42318", "#c2410c", "#a16207", "#7c3aed", "#be185d", "#334155"];

/**
 * Owner/admin picker for the business accent colour. The preview uses the same palette
 * the portal applies, including the readability adjustment.
 */
export function BrandColorCard({
  value,
  canEdit,
  onSave,
}: {
  value: string | null;
  canEdit: boolean;
  onSave: (color: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState(value ?? DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);

  const valid = HEX_COLOR.test(draft);
  const theme = useMemo(() => buildBusinessTheme(valid ? draft : DEFAULT_COLOR), [draft, valid]);
  const unchanged = (value ?? DEFAULT_COLOR).toLowerCase() === draft.toLowerCase();

  function choose(color: string) {
    setDraft(color);
    setHexInput(color);
  }

  async function save(color: string | null) {
    setBusy(true);
    try {
      await onSave(color);
      if (color === null) choose(DEFAULT_COLOR);
    } finally {
      setBusy(false);
    }
  }

  const previewStyle = {
    "--p-brand": theme.light.brand,
    "--p-hover": theme.light.hover,
    "--p-soft": theme.light.soft,
    "--p-contrast": theme.light.contrast,
  } as CSSProperties;

  return (
    <Card>
      <CardHeader
        title="Brand colour"
        description="Your team sees the portal in this colour. It's also the accent on modern receipts, invoices and quotations."
      />
      <div className="stack">
        <div className="brand-color-row">
          <input
            type="color"
            aria-label="Pick a brand colour"
            value={valid ? draft : DEFAULT_COLOR}
            disabled={!canEdit}
            onChange={(e) => choose(e.target.value)}
            className="brand-color-input"
          />
          <Field label="Hex code" htmlFor="brand_hex" error={hexInput && !HEX_COLOR.test(hexInput) ? "Use six hex digits, e.g. #1f7a5c" : undefined}>
            <Input
              id="brand_hex"
              value={hexInput}
              maxLength={7}
              disabled={!canEdit}
              onChange={(e) => {
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                setHexInput(v);
                if (HEX_COLOR.test(v)) setDraft(v.toLowerCase());
              }}
            />
          </Field>
        </div>

        {canEdit && (
          <div className="swatch-row" role="group" aria-label="Suggested colours">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch${c === draft.toLowerCase() ? " swatch--selected" : ""}`}
                style={{ background: c }}
                aria-label={`Use ${c}`}
                aria-pressed={c === draft.toLowerCase()}
                onClick={() => choose(c)}
              />
            ))}
          </div>
        )}

        <div className="brand-preview" style={previewStyle} aria-label="Preview">
          <span className="brand-preview-btn">Primary button</span>
          <span className="brand-preview-link">A link</span>
          <span className="brand-preview-badge">Selected</span>
        </div>

        {theme.adjusted && (
          <Alert tone="info">This colour is slightly darkened in the portal so text and links stay readable.</Alert>
        )}

        {canEdit && (
          <div className="action-bar">
            {value && (
              <Button variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => save(null)}>
                Reset to default
              </Button>
            )}
            <Button icon={Palette} isLoading={busy} disabled={!valid || unchanged} onClick={() => save(draft.toLowerCase())}>
              Save colour
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
