/**
 * Local calendar-day utilities.
 *
 * TRAP #1 from HANDOFF.md §8: `toISOString().slice(0,10)` returns the **UTC** date.
 * In Australia/Sydney that made the streak counter walk 14 Aug -> 12 Aug -> 10 Aug,
 * counting every *other* day. Every date key in this app is a LOCAL calendar day:
 * no time, no timezone, no UTC anywhere.
 */

/** A local calendar day, "YYYY-MM-DD". Never derived from an instant in UTC. */
export type DayKey = string;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a Date, in the runtime's own timezone. */
export function isoLocal(d: Date): DayKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today, as a local calendar day. */
export function todayKey(now: Date = new Date()): DayKey {
  return isoLocal(now);
}

/**
 * Parse "YYYY-MM-DD" into a local-midnight Date.
 * `new Date("2026-08-14")` parses as UTC midnight — which is the same bug wearing
 * a different hat — so the parts are passed to the Date constructor explicitly.
 */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Shift a day key by whole days, staying on local calendar days across DST. */
export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

/**
 * Whole calendar days from `a` to `b` (b - a). DST-safe: both ends are snapped to
 * local noon first, so a 23- or 25-hour day still measures as exactly one day.
 */
export function daysBetween(a: DayKey, b: DayKey): number {
  const da = parseDay(a);
  const db = parseDay(b);
  da.setHours(12, 0, 0, 0);
  db.setHours(12, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** True if `key` is a well-formed local calendar day that round-trips. */
export function isValidDay(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return isoLocal(parseDay(key)) === key;
}

/** Every day key in [from, to] inclusive. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; daysBetween(k, to) >= 0; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Days in a month, for calendar grids. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Weekday index (0 = Sunday) of the 1st of a month, for calendar grid offset. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}
