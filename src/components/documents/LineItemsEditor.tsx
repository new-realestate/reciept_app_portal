import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "../../lib/format";
import { Button, Field, IconButton, Input, Select } from "../ui/ui";
import { emptyRow, type EstimatedTotals, type LineRow } from "./lineItems";

export type DiscountMode = "none" | "percent" | "fixed";

export function LineItemsEditor({
  rows,
  onChange,
  currency,
  totals,
  discountMode,
  discountValue,
  onDiscountChange,
  errors,
  disabled,
}: {
  rows: LineRow[];
  onChange: (rows: LineRow[]) => void;
  currency: string;
  totals: EstimatedTotals;
  discountMode: DiscountMode;
  discountValue: string;
  onDiscountChange: (mode: DiscountMode, value: string) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<LineRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="line-items">
      <div className="line-items-head" aria-hidden>
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span>Tax %</span>
        <span className="cell-end">Amount</span>
        <span />
      </div>

      {rows.map((row, i) => (
        <div className="line-item-row" key={row.key} role="group" aria-label={`Line item ${i + 1}`}>
          <Field label="Description" htmlFor={`li-desc-${i}`} error={errors[`line_${i}_description`]} className="field--compact">
            <Input
              id={`li-desc-${i}`}
              value={row.description}
              disabled={disabled}
              placeholder="e.g. Monthly rent"
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </Field>
          <Field label="Quantity" htmlFor={`li-qty-${i}`} error={errors[`line_${i}_quantity`]} className="field--compact">
            <Input
              id={`li-qty-${i}`}
              inputMode="decimal"
              value={row.quantity}
              disabled={disabled}
              onChange={(e) => update(i, { quantity: e.target.value })}
            />
          </Field>
          <Field label={`Unit price (${currency})`} htmlFor={`li-price-${i}`} error={errors[`line_${i}_price`]} className="field--compact">
            <Input
              id={`li-price-${i}`}
              inputMode="decimal"
              value={row.unitPrice}
              disabled={disabled}
              placeholder="0.00"
              onChange={(e) => update(i, { unitPrice: e.target.value })}
            />
          </Field>
          <Field label="Tax %" htmlFor={`li-tax-${i}`} error={errors[`line_${i}_tax`]} className="field--compact">
            <Input
              id={`li-tax-${i}`}
              inputMode="decimal"
              value={row.taxRate}
              disabled={disabled}
              placeholder="0"
              onChange={(e) => update(i, { taxRate: e.target.value })}
            />
          </Field>
          <div className="line-amount" aria-label={`Line ${i + 1} amount`}>
            {formatMoney(totals.lineTotals[i] ?? 0, currency)}
          </div>
          <IconButton
            label={`Remove line item ${i + 1}`}
            icon={Trash2}
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}

      <div className="line-items-actions">
        <Button variant="secondary" size="sm" icon={Plus} disabled={disabled} onClick={() => onChange([...rows, emptyRow()])}>
          Add line item
        </Button>
        {errors.lines && (
          <p className="field-error" role="alert">
            {errors.lines}
          </p>
        )}
      </div>

      <div className="totals-panel">
        <div className="discount-controls">
          <Field label="Discount" htmlFor="discount-mode" className="field--compact">
            <Select
              id="discount-mode"
              value={discountMode}
              disabled={disabled}
              onChange={(e) => onDiscountChange(e.target.value as DiscountMode, "")}
            >
              <option value="none">No discount</option>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </Select>
          </Field>
          {discountMode !== "none" && (
            <Field
              label={discountMode === "percent" ? "Discount %" : `Discount (${currency})`}
              htmlFor="discount-value"
              error={errors.discount}
              className="field--compact"
            >
              <Input
                id="discount-value"
                inputMode="decimal"
                value={discountValue}
                disabled={disabled}
                onChange={(e) => onDiscountChange(discountMode, e.target.value)}
              />
            </Field>
          )}
        </div>
        <dl className="totals-list" aria-live="polite">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotal, currency)}</dd>
          </div>
          {totals.discount > 0 && (
            <div>
              <dt>Discount</dt>
              <dd>- {formatMoney(totals.discount, currency)}</dd>
            </div>
          )}
          {totals.tax > 0 && (
            <div>
              <dt>Tax</dt>
              <dd>{formatMoney(totals.tax, currency)}</dd>
            </div>
          )}
          <div className="totals-grand">
            <dt>Total</dt>
            <dd>{formatMoney(totals.total, currency)}</dd>
          </div>
        </dl>
      </div>
      <p className="field-hint">Totals are calculated again by the server when you save.</p>
    </div>
  );
}
