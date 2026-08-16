import { describe, expect, it } from "vitest";
import { derive } from "../src/core/derive";
import { btcToSats, fiatToCents } from "../src/core/money";
import { WORLDS, computeScene, computeWorldState, newlySeenScenes } from "../src/core/progression";
import type { Entry } from "../src/core/types";

const BTC = WORLDS.btc;

let n = 0;
const entry = (btc: string, date = "2026-08-14"): Entry => ({
  id: `p${n++}`,
  date,
  sats: btcToSats(btc),
  fiatCents: fiatToCents("1.00"),
});

describe("progression (scenes are data, gated on accumulated sats only)", () => {
  it("starts on the bare plot", () => {
    const w = computeWorldState(BTC, derive([], "2026-08-14"));
    expect(w.sceneId).toBe("bare_land");
    expect(w.image).toBe("stage_00");
    expect(w.progressToGoal).toBe(0);
  });

  it("changes the world on the FIRST recorded purchase, any size", () => {
    // The whole emotional payload of the app rides on this one assertion.
    const d = derive([entry("0.0000001")], "2026-08-14"); // 10 sats — the smallest real buy
    const w = computeWorldState(BTC, d);
    expect(w.sceneId).toBe("first_light");
    expect(w.image).toBe("stage_01");
  });

  it("is gated purely on accumulated sats — never on days recorded or streak", () => {
    // A single lump-sum buy, entered once, must be able to reach ANY scene.
    // This is the owner's real usage pattern: irregular lump sums, not daily
    // habit — see DECISIONS.md. Days recorded here is 1, streak is <=1.
    const whale = derive([entry("0.2")], "2026-08-14");
    expect(whale.daysRecorded).toBe(1);
    expect(computeWorldState(BTC, whale).sceneId).toBe("citadel");
  });

  it("reaches the goal at exactly 0.2 BTC and clamps progress at 100%", () => {
    const atGoal = computeWorldState(BTC, derive([entry("0.2")], "2026-08-14"));
    expect(atGoal.progressToGoal).toBe(1);
    expect(atGoal.nextScene).toBeNull();

    const overGoal = computeWorldState(BTC, derive([entry("0.5")], "2026-08-14"));
    expect(overGoal.progressToGoal).toBe(1); // clamped, never over 100%
    expect(overGoal.sceneId).toBe("citadel");
  });

  it("walks every threshold in the prompt pack in order", () => {
    // Mirrors docs/ART_PROMPTS_BTC.md exactly — if this drifts, the art and the
    // code have gone out of sync.
    const checkpoints: Array<[string, string]> = [
      ["0.000000", "bare_land"],
      ["0.0000001", "first_light"],
      ["0.004", "cottage"],
      ["0.01", "tilled_soil"],
      ["0.016", "crops"],
      ["0.024", "coop"],
      ["0.03", "dog"],
      ["0.04", "cottage2"],
      ["0.05", "stream"],
      ["0.06", "bridge"],
      ["0.07", "chest1"],
      ["0.084", "cow"],
      ["0.1", "manor"],
      ["0.116", "chest2"],
      ["0.13", "well"],
      ["0.15", "dock"],
      ["0.17", "villagers"],
      ["0.2", "citadel"],
    ];
    for (const [btc, sceneId] of checkpoints) {
      const sats = btc === "0.000000" ? 0 : btcToSats(btc);
      expect(computeScene(BTC, sats).id, `${btc} BTC`).toBe(sceneId);
    }
  });

  it("never regresses the world when the market would have fallen", () => {
    // There is no price input anywhere in this pipeline — that is the guarantee.
    // A drawdown cannot reach the world because the world never reads a price.
    const d = derive([entry("0.05")], "2026-08-14");
    const w1 = computeWorldState(BTC, d);
    const w2 = computeWorldState(BTC, d);
    expect(w2).toEqual(w1);
    expect(JSON.stringify(Object.keys(d))).not.toContain("price");
  });

  it("reports progress toward the next scene, not just the current one", () => {
    // Halfway between cottage (400,000) and tilled_soil (1,000,000).
    const halfway = derive([entry("0.007")], "2026-08-14"); // 700,000 sats
    const w = computeWorldState(BTC, halfway);
    expect(w.sceneId).toBe("cottage");
    expect(w.nextScene?.id).toBe("tilled_soil");
    expect(w.progressToNext).toBeCloseTo(0.5, 5);
  });

  it("batches a jump across many thresholds into ONE list, not one popup each", () => {
    const d = derive([entry("0.2")], "2026-08-14"); // straight to citadel
    const scene = computeScene(BTC, d.totalSats);
    const fresh = newlySeenScenes(BTC, scene, null);
    expect(fresh.map((s) => s.id).at(-1)).toBe("citadel");
    expect(fresh.length).toBe(BTC.scenes.length - 1); // every scene except bare_land
  });

  it("shows nothing new once the user has acknowledged the current scene", () => {
    const d = derive([entry("0.05")], "2026-08-14");
    const scene = computeScene(BTC, d.totalSats);
    expect(newlySeenScenes(BTC, scene, scene.id)).toEqual([]);
  });

  it("keeps the scene table internally consistent and strictly ascending", () => {
    const ids = new Set(BTC.scenes.map((s) => s.id));
    expect(ids.size).toBe(BTC.scenes.length);
    for (let i = 1; i < BTC.scenes.length; i++) {
      expect(BTC.scenes[i].minSats, BTC.scenes[i].id).toBeGreaterThan(BTC.scenes[i - 1].minSats);
    }
    expect(BTC.scenes.at(-1)?.minSats).toBe(BTC.goalSats);
  });
});
