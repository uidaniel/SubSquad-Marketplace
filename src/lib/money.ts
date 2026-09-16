/**
 * Money.
 *
 * Every amount in the system is an integer number of kobo. There are no float
 * naira values anywhere — not in the database, not in the domain, not in props.
 * ₦1 = 100 kobo, so an `int` of kobo stays exact well past any campaign budget
 * this product will ever see (the JS safe-integer ceiling is ~₦90 billion).
 *
 * The one place a decimal appears is at the edges: parsing a form field and
 * rendering a figure. Both live here.
 */

/** A whole number of kobo. Negative values are legal — the ledger debits with them. */
export type Kobo = number;

export const KOBO_PER_NAIRA = 100;

/** Basis points, e.g. 1200 = 12%. Fees are stored in bps to avoid decimals. */
export type Bps = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Throws unless `value` is a whole, finite, in-range number of kobo. */
export function assertKobo(value: number, label = "amount"): asserts value is Kobo {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${label} must be a finite number, got ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(
      `${label} must be a whole number of kobo, got ${value} — money never carries a fraction of a kobo`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} is outside the safe integer range: ${value}`);
  }
}

/** Throws unless `value` is a whole number of kobo greater than zero. */
export function assertPositiveKobo(value: number, label = "amount"): asserts value is Kobo {
  assertKobo(value, label);
  if (value <= 0) {
    throw new MoneyError(`${label} must be greater than zero, got ${value}`);
  }
}

export function nairaToKobo(naira: number): Kobo {
  if (!Number.isFinite(naira)) {
    throw new MoneyError(`naira must be a finite number, got ${naira}`);
  }
  // Round rather than truncate: 0.1 + 0.2 style drift would otherwise lose a kobo.
  const kobo = Math.round(naira * KOBO_PER_NAIRA);
  assertKobo(kobo, "naira");
  return kobo;
}

export function koboToNaira(kobo: Kobo): number {
  assertKobo(kobo);
  return kobo / KOBO_PER_NAIRA;
}

/**
 * Applies a basis-point rate, rounding down.
 *
 * Rounding down is deliberate and consistent: the platform never rounds a fee
 * up against the party paying it.
 */
export function applyBps(amount: Kobo, bps: Bps): Kobo {
  assertKobo(amount, "amount");
  if (!Number.isInteger(bps) || bps < 0) {
    throw new MoneyError(`bps must be a non-negative whole number, got ${bps}`);
  }
  return Math.floor((amount * bps) / 10_000);
}

/**
 * Splits an amount by percentage without losing or inventing a kobo.
 *
 * The remainder goes to the first party, so `split(101, 2)` is `[99, 2]` — the
 * smaller share is exact and the larger one absorbs the rounding.
 */
export function splitOff(amount: Kobo, percentToSecond: number): [Kobo, Kobo] {
  assertKobo(amount, "amount");
  if (amount < 0) throw new MoneyError("cannot split a negative amount");
  if (percentToSecond < 0 || percentToSecond > 100) {
    throw new MoneyError(`percent must be 0–100, got ${percentToSecond}`);
  }
  const second = Math.floor((amount * percentToSecond) / 100);
  return [amount - second, second];
}

const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const nairaFormatWithKobo = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Renders kobo as naira for display.
 *
 * Whole naira lose the ".00" — a campaign budget reads ₦4,500,000, not
 * ₦4,500,000.00. Amounts carrying kobo keep both decimals so nothing is hidden.
 */
export function formatNaira(kobo: Kobo, opts?: { alwaysShowKobo?: boolean }): string {
  assertKobo(kobo);
  const naira = kobo / KOBO_PER_NAIRA;
  const hasKobo = kobo % KOBO_PER_NAIRA !== 0;
  const fmt = opts?.alwaysShowKobo || hasKobo ? nairaFormatWithKobo : nairaFormat;
  // Intl renders NGN as "₦" already; normalise the non-breaking space it inserts.
  return fmt.format(naira).replace(/ /g, "");
}

/** Short form for dense tables and charts: ₦4.5m, ₦640k, ₦900. */
export function formatNairaShort(kobo: Kobo): string {
  assertKobo(kobo);
  const naira = Math.abs(kobo) / KOBO_PER_NAIRA;
  const sign = kobo < 0 ? "-" : "";
  if (naira >= 1_000_000) {
    const m = naira / 1_000_000;
    return `${sign}₦${trimZero(m >= 10 ? m.toFixed(0) : m.toFixed(1))}m`;
  }
  if (naira >= 1_000) {
    const k = naira / 1_000;
    return `${sign}₦${trimZero(k >= 10 ? k.toFixed(0) : k.toFixed(1))}k`;
  }
  return `${sign}₦${Math.round(naira)}`;
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/**
 * Parses what a person typed into a naira field: "4,500,000", "₦4500000",
 * "4500.50". Returns null when the input is not a usable amount, so callers can
 * show a field error rather than guess.
 */
export function parseNairaInput(input: string): Kobo | null {
  const cleaned = input.replace(/[₦,\s]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const naira = Number(cleaned);
  if (!Number.isFinite(naira)) return null;
  try {
    return nairaToKobo(naira);
  } catch {
    return null;
  }
}

/** "12%" from 1200 bps, "6.5%" from 650. */
export function formatBps(bps: Bps): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
}
