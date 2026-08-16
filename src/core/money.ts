/**
 * Integer money (L6).
 *
 * BTC is satoshis, fiat is cents, and nothing in this file ever produces an
 * intermediate float. `0.1 + 0.2 !== 0.3` would silently corrupt a two-year
 * savings record, and the user would never trust the app again.
 *
 * Decimal *strings* from form inputs are parsed digit-by-digit rather than with
 * `parseFloat`, because `parseFloat("0.00014") * 1e8` is 14000.000000000002.
 */

export const SATS_PER_BTC = 100_000_000;

export class MoneyError extends Error {}

/**
 * "0.00014" with 8 decimals -> 14000.
 *
 * Rejects rather than rounds when the input carries more precision than the
 * unit can hold: silently dropping a digit off someone's purchase is worse than
 * making them retype it.
 */
export function decimalToInt(input: string, decimals: number): number {
  const s = String(input).trim().replace(/,/g, "").replace(/\s/g, "");
  if (s === "" || s === "." || !/^\d*(\.\d*)?$/.test(s)) {
    throw new MoneyError(`not a positive decimal: "${input}"`);
  }
  const [whole = "", frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new MoneyError(`"${input}" has more than ${decimals} decimal places`);
  }
  const digits = `${whole || "0"}${frac.padEnd(decimals, "0")}`;
  const n = Number(digits.replace(/^0+(?=\d)/, ""));
  if (!Number.isSafeInteger(n)) throw new MoneyError(`"${input}" is out of safe integer range`);
  return n;
}

/** 14000 with 8 decimals -> "0.00014000". Trailing zeros trimmed when asked. */
export function intToDecimal(value: number, decimals: number, trim = false): string {
  if (!Number.isInteger(value)) throw new MoneyError(`${value} is not an integer`);
  const neg = value < 0;
  const digits = String(Math.abs(value)).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  let frac = digits.slice(digits.length - decimals);
  if (trim) frac = frac.replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : whole;
  return neg ? `-${out}` : out;
}

export const btcToSats = (btc: string): number => decimalToInt(btc, 8);
export const satsToBtc = (sats: number, trim = false): string => intToDecimal(sats, 8, trim);

export const fiatToCents = (fiat: string): number => decimalToInt(fiat, 2);
export const centsToFiat = (cents: number, trim = false): string => intToDecimal(cents, 2, trim);

/** Round-half-up division of BigInts. Keeps the whole chain in integers. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new MoneyError("divide by zero");
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * How many satoshis a fiat amount buys at a given price.
 * `sats = fiatCents * 1e8 / priceCentsPerBtc`, exact then rounded once.
 */
export function satsFor(fiatCents: number, priceCentsPerBtc: number): number {
  if (priceCentsPerBtc <= 0) throw new MoneyError("price must be positive");
  const sats = divRound(BigInt(fiatCents) * BigInt(SATS_PER_BTC), BigInt(priceCentsPerBtc));
  const n = Number(sats);
  if (!Number.isSafeInteger(n)) throw new MoneyError("result out of safe integer range");
  return n;
}

/**
 * The price actually paid, derived — never stored (L6).
 * `priceCentsPerBtc = fiatCents * 1e8 / sats`.
 */
export function priceCentsPerBtc(fiatCents: number, sats: number): number {
  if (sats <= 0) return 0;
  return Number(divRound(BigInt(fiatCents) * BigInt(SATS_PER_BTC), BigInt(sats)));
}

/** Thai-locale display for a fiat amount held in cents. */
export function formatFiat(cents: number, currency = "$"): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  const sign = cents < 0 ? "-" : "";
  return `${sign}${currency}${whole.toLocaleString("en-US")}.${frac}`;
}

/** Compact BTC display: 8dp, trailing zeros trimmed, but never bare "0". */
export function formatBtc(sats: number): string {
  const s = satsToBtc(sats, true);
  return s.includes(".") || s === "0" ? s : s;
}
