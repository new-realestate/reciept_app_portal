import { centsFromInput, inputFromCents } from "../../lib/format";
import type { LineItem, LineItemInput } from "../../lib/documentTypes";

export interface LineRow {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string; // major units as typed, e.g. "1500.50"
  taxRate: string; // percent as typed, "" for none
}

let counter = 0;
export function emptyRow(): LineRow {
  counter += 1;
  return { key: `row-${counter}`, description: "", quantity: "1", unitPrice: "", taxRate: "" };
}

export function rowsFromLineItems(items: LineItem[]): LineRow[] {
  if (items.length === 0) return [emptyRow()];
  return items.map((li) => {
    counter += 1;
    return {
      key: `row-${counter}`,
      description: li.description,
      quantity: String(Number(li.quantity)),
      unitPrice: inputFromCents(li.unit_price_cents),
      taxRate: li.tax_rate ? String(Number(li.tax_rate)) : "",
    };
  });
}

export function rowsToPayload(rows: LineRow[]): LineItemInput[] {
  return rows.map((r) => ({
    description: r.description.trim(),
    quantity: r.quantity.trim(),
    unit_price_cents: centsFromInput(r.unitPrice),
    tax_rate: r.taxRate.trim() === "" ? null : r.taxRate.trim(),
  }));
}

export interface EstimatedTotals {
  lineTotals: number[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const roundHalfUp = (n: number) => Math.floor(n + 0.5);

/**
 * Live preview only. The server recomputes every amount with exact decimal maths
 * when the document is saved, and its figures are the ones that are stored and shown.
 */
export function estimateTotals(rows: LineRow[], discountMode: "none" | "percent" | "fixed", discountValue: string): EstimatedTotals {
  const lineTotals = rows.map((r) => {
    const qty = Number.parseFloat(r.quantity);
    return Number.isFinite(qty) && qty > 0 ? roundHalfUp(qty * centsFromInput(r.unitPrice)) : 0;
  });
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);

  let discount = 0;
  if (discountMode === "percent") {
    const pct = Number.parseFloat(discountValue);
    if (Number.isFinite(pct)) discount = roundHalfUp((subtotal * Math.min(Math.max(pct, 0), 100)) / 100);
  } else if (discountMode === "fixed") {
    discount = Math.min(centsFromInput(discountValue), subtotal);
  }

  const rawTax = rows.reduce((sum, r, i) => {
    const rate = Number.parseFloat(r.taxRate);
    return sum + (Number.isFinite(rate) ? (lineTotals[i] * rate) / 100 : 0);
  }, 0);
  const tax = subtotal > 0 ? roundHalfUp((rawTax * (subtotal - discount)) / subtotal) : 0;

  return { lineTotals, subtotal, discount, tax, total: subtotal - discount + tax };
}
