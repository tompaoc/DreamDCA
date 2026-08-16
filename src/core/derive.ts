import { addDays, daysBetween, todayKey } from "./date";
import type { DayKey } from "./date";
import { SATS_PER_BTC } from "./money";
import type { DayTotal, Derived, Entry } from "./types";

/**
 * ledger -> derived. Pure, total, and cheap enough to run on every mutation.
 *
 * This purity is what makes backfill free (L5): inserting a January entry in
 * August is just another recompute, not a replay of eight months of side effects.
 */
export function derive(entries: readonly Entry[], today: DayKey = todayKey()): Derived {
  const byDay: Record<DayKey, DayTotal> = {};
  let totalSats = 0;
  let totalFiatCents = 0;

  for (const e of entries) {
    totalSats += e.sats;
    totalFiatCents += e.fiatCents;
    const d = (byDay[e.date] ??= { sats: 0, fiatCents: 0, count: 0 });
    d.sats += e.sats;
    d.fiatCents += e.fiatCents;
    d.count += 1;
  }

  const days = Object.keys(byDay).sort();
  const recorded = new Set(days);

  return {
    totalSats,
    totalFiatCents,
    avgCostCentsPerBtc:
      totalSats > 0
        ? Number(
            (BigInt(totalFiatCents) * BigInt(SATS_PER_BTC) * 2n + BigInt(totalSats)) /
              (BigInt(totalSats) * 2n),
          )
        : 0,
    daysRecorded: days.length,
    streak: currentStreak(recorded, today),
    longestStreak: longestStreak(days),
    entryCount: entries.length,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null,
    byDay,
  };
}

/**
 * Consecutive recorded days ending today.
 *
 * Deliberately forgiving: a streak still counts if today has not been recorded
 * *yet*, as long as yesterday was. Otherwise every user's streak would read as
 * broken every morning until they opened the app — punishing them for the clock,
 * which is exactly the shaming the design principle forbids.
 */
export function currentStreak(recorded: ReadonlySet<DayKey>, today: DayKey): number {
  let cursor = recorded.has(today) ? today : addDays(today, -1);
  if (!recorded.has(cursor)) return 0;
  let n = 0;
  while (recorded.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** The longest run of consecutive recorded days, anywhere in the history. */
export function longestStreak(sortedDays: readonly DayKey[]): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    run = i > 0 && daysBetween(sortedDays[i - 1], sortedDays[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}
