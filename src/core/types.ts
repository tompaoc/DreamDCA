import type { DayKey } from "./date";

/**
 * One recorded purchase. The append-only ledger of these is the ONLY source of
 * truth in the app (L5); everything else is a pure function of it.
 *
 * Integers only (L6). `priceAtBuy` is deliberately absent — it is derived from
 * `fiatCents / (sats/1e8)` so it can never drift out of agreement with the
 * numbers it came from.
 */
export type Entry = {
  id: string;
  /** LOCAL calendar day. No time, no timezone. */
  date: DayKey;
  /** Satoshis. Integer. */
  sats: number;
  /** Fiat minor units (cents). Integer. */
  fiatCents: number;
  note?: string;
};

/** What one calendar day adds up to. */
export type DayTotal = {
  sats: number;
  fiatCents: number;
  count: number;
};

/** Everything downstream reads this, never the raw ledger. */
export type Derived = {
  totalSats: number;
  totalFiatCents: number;
  /** Weighted average cost, in fiat cents per whole BTC. 0 when nothing is held. */
  avgCostCentsPerBtc: number;
  /** Distinct calendar days with at least one entry. */
  daysRecorded: number;
  /** Consecutive days up to today (or yesterday, if today is not recorded yet). */
  streak: number;
  longestStreak: number;
  entryCount: number;
  firstDay: DayKey | null;
  lastDay: DayKey | null;
  byDay: Record<DayKey, DayTotal>;
};

/**
 * One painted background scene, keyed off accumulated sats (not streak, not
 * days recorded — see DECISIONS.md: the owner accumulates in irregular lump
 * sums, so "days recorded" would strand a real accumulator on the first scene
 * for months). `image` is the basename under `public/art/<world>/`, no
 * extension — the view picks the format.
 */
export type Scene = {
  id: string;
  minSats: number;
  image: string;
  label: string;
};

export type WorldState = {
  world: string;
  sceneId: string;
  image: string;
  label: string;
  goalSats: number;
  totalSats: number;
  /** 0..1, total progress toward the world goal. */
  progressToGoal: number;
  nextScene: Scene | null;
  /** 0..1, progress from the current scene's threshold toward the next one's. */
  progressToNext: number;
};
