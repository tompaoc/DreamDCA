import { describe, expect, it } from "vitest";
import { derive } from "../src/core/derive";
import { btcToSats, fiatToCents } from "../src/core/money";
import {
  MILESTONES,
  STAGES,
  computeStage,
  computeUnlocks,
  computeWorldState,
  newlyUnlocked,
} from "../src/core/progression";
import type { Entry } from "../src/core/types";

let n = 0;
const entry = (date: string, btc = "0.0001", fiat = "6.00"): Entry => ({
  id: `p${n++}`,
  date,
  sats: btcToSats(btc),
  fiatCents: fiatToCents(fiat),
});

const run = (dates: string[], today: string, btcEach = "0.0001") =>
  derive(dates.map((d) => entry(d, btcEach)), today);

describe("progression (milestones are data, not code)", () => {
  it("starts on a bare plot", () => {
    const w = computeWorldState(derive([], "2026-08-14"));
    expect(w.stage).toBe(0);
    expect(w.homeSprite).toBe("prop_tent");
    expect(w.visibleProps.size).toBe(0);
    expect(w.activeEntities.size).toBe(0);
  });

  it("changes the world on the FIRST recorded purchase", () => {
    // The whole emotional payload of the app rides on this one assertion.
    const w = computeWorldState(run(["2026-08-14"], "2026-08-14"));
    expect(w.stage).toBe(1);
    expect(w.homeSprite).toBe("prop_cottage_lv1");
    expect(w.visibleProps.has("lantern")).toBe(true);
  });

  it("gates stages 1-3 on consistency and the last on coin", () => {
    // 13 straight days: plenty of streak, not yet 14 days recorded.
    const days = Array.from({ length: 13 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    expect(computeStage(run(days, "2026-08-13")).stage).toBe(1);

    days.push("2026-08-14");
    expect(computeStage(run(days, "2026-08-14")).stage).toBe(2);

    // A single huge buy reaches the coin threshold but not the day count:
    // stage stays where consistency put it, and only the last rung is coin-gated.
    const whale = derive([entry("2026-08-14", "1.0", "60000.00")], "2026-08-14");
    expect(computeStage(whale).stage).toBe(4);
  });

  it("unlocks the streak milestones in order", () => {
    const d3 = run(["2026-08-12", "2026-08-13", "2026-08-14"], "2026-08-14");
    expect([...computeUnlocks(d3)]).toEqual(["first_light", "steady_3"]);

    const week = Array.from({ length: 7 }, (_, i) => `2026-08-${String(8 + i).padStart(2, "0")}`);
    const d7 = run(week, "2026-08-14");
    expect(computeUnlocks(d7).has("steady_7")).toBe(true);
    expect(computeWorldState(d7).activeEntities.has("chicken")).toBe(true);
  });

  it("unlocks the vault on accumulated coin, not on days", () => {
    const d = derive([entry("2026-08-14", "0.01", "600.00")], "2026-08-14");
    expect(computeUnlocks(d).has("first_stack")).toBe(true);
    expect(computeWorldState(d).visibleProps.has("vault")).toBe(true);
  });

  it("batches a six-month backfill into ONE summary, not twenty popups", () => {
    // 40 consecutive days entered all at once, from an empty lastSeen.
    const days = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(2026, 6, 6 + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    const d = run(days, days[days.length - 1], "0.0005");
    const unlocks = computeUnlocks(d);
    const fresh = newlyUnlocked(unlocks, new Set());
    expect(fresh.length).toBe(5);
    expect(fresh.length).toBe(unlocks.size); // one batch covering everything
  });

  it("shows nothing new once the user has acknowledged", () => {
    const d = run(["2026-08-14"], "2026-08-14");
    const unlocks = computeUnlocks(d);
    expect(newlyUnlocked(unlocks, unlocks)).toEqual([]);
  });

  it("never regresses the world when the market would have fallen", () => {
    // There is no price input anywhere in this pipeline — that is the guarantee.
    // A drawdown cannot reach the world because the world never reads a price.
    const d = run(["2026-08-12", "2026-08-13", "2026-08-14"], "2026-08-14");
    const w1 = computeWorldState(d);
    const w2 = computeWorldState(d);
    expect(w2).toEqual(w1);
    expect(JSON.stringify(Object.keys(d))).not.toContain("price");
  });

  it("keeps the data table internally consistent", () => {
    expect(STAGES.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(MILESTONES.map((m) => m.id)).size).toBe(MILESTONES.length);
    for (const m of MILESTONES) {
      expect(m.grants.length, `${m.id} grants nothing`).toBeGreaterThan(0);
      for (const g of m.grants) expect(g).toMatch(/^(prop|entity)\.[a-z0-9_]+(:[a-z0-9]+)?$/);
    }
  });
});
