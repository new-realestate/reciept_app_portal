export function formatMoney(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function centsFromInput(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Formats a date-only value ("2026-10-23") without shifting it across a timezone boundary. */
export function formatDay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Today as YYYY-MM-DD in the browser's local timezone (for date inputs). */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Cents back to a plain decimal string for editing, e.g. 150050 -> "1500.50". */
export function inputFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** An amount without a currency code, e.g. "1,500,000" (for values whose currency is set elsewhere). */
export function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
