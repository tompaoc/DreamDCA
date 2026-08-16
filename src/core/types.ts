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

/** A grant token from the milestone table: "prop.bench", "prop.cottage:lv3", "entity.dog". */
export type Grant = string;

export type Requirement = {
  sats?: number;
  fiatCents?: number;
  daysRecorded?: number;
  streak?: number;
};

export type Milestone = {
  id: string;
  /** Thai, shown in the unlock summary. */
  label: string;
  requires: Requirement;
  grants: Grant[];
};

export type StageDef = {
  stage: number;
  label: string;
  /** Sprite key for the home node at this stage — the BTC unlock ladder. */
  home: string;
  requires: Requirement;
};

export type WorldState = {
  stage: number;
  stageLabel: string;
  homeSprite: string;
  /** Prop ids that should be on screen. */
  visibleProps: Set<string>;
  /** Prop id -> sprite key, for props whose variant was swapped by a grant. */
  propVariants: Record<string, string>;
  /** Entity keys that should be spawned: "chicken", "dog", ... */
  activeEntities: Set<string>;
};
