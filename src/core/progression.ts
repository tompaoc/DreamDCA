import btcHomestead from "../data/btc-homestead.json";
import type { Derived, Scene, WorldState } from "./types";

export type WorldDef = {
  id: string;
  goalSats: number;
  scenes: Scene[];
};

/** Only BTC ships in Phase 1 (HANDOFF.md §4.3) — the other seven worlds are future data files. */
export const WORLDS: Record<string, WorldDef> = {
  btc: { id: "btc", goalSats: btcHomestead.goalSats, scenes: btcHomestead.scenes as Scene[] },
};

/** The highest scene whose threshold is met. Scenes are authored in ascending minSats order. */
export function computeScene(world: WorldDef, totalSats: number): Scene {
  let current = world.scenes[0];
  for (const s of world.scenes) {
    if (totalSats < s.minSats) break;
    current = s;
  }
  return current;
}

/** derived -> worldState. Pure — no price input exists anywhere in this chain (L rule: never tied to market price). */
export function computeWorldState(world: WorldDef, d: Derived): WorldState {
  const scene = computeScene(world, d.totalSats);
  const idx = world.scenes.findIndex((s) => s.id === scene.id);
  const next = world.scenes[idx + 1] ?? null;
  const progressToNext = next
    ? clamp01((d.totalSats - scene.minSats) / (next.minSats - scene.minSats))
    : 1;

  return {
    world: world.id,
    sceneId: scene.id,
    image: scene.image,
    label: scene.label,
    goalSats: world.goalSats,
    totalSats: d.totalSats,
    progressToGoal: clamp01(d.totalSats / world.goalSats),
    nextScene: next,
    progressToNext,
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Scenes crossed since the user last looked, in order. This is a DIFF against
 * `lastSeenSceneId`, not an event fired on insert — so backfilling six months
 * of purchases at once yields one batched summary, not a popup per threshold.
 */
export function newlySeenScenes(world: WorldDef, current: Scene, lastSeenSceneId: string | null): Scene[] {
  if (lastSeenSceneId === current.id) return [];
  // scenes[0] (minSats: 0) is the empty starting state, met before any entry
  // exists — never worth announcing as a "grew" moment, so a fresh install
  // (lastSeenSceneId === null) starts counting from index 1, not 0.
  const lastIdx = lastSeenSceneId ? world.scenes.findIndex((s) => s.id === lastSeenSceneId) : 0;
  const currentIdx = world.scenes.findIndex((s) => s.id === current.id);
  if (currentIdx <= lastIdx) return [];
  return world.scenes.slice(lastIdx + 1, currentIdx + 1);
}
