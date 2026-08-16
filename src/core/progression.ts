import progression from "../data/progression.json";
import type { Derived, Grant, Milestone, Requirement, StageDef, WorldState } from "./types";

export const STAGES = progression.stages as StageDef[];
export const MILESTONES = progression.milestones as Milestone[];

/** Every requirement key must be met. An empty requirement is always met. */
export function meets(d: Derived, r: Requirement): boolean {
  if (r.sats !== undefined && d.totalSats < r.sats) return false;
  if (r.fiatCents !== undefined && d.totalFiatCents < r.fiatCents) return false;
  if (r.daysRecorded !== undefined && d.daysRecorded < r.daysRecorded) return false;
  if (r.streak !== undefined && d.streak < r.streak) return false;
  return true;
}

/** derived -> unlocks. Pure. */
export function computeUnlocks(d: Derived): Set<string> {
  const out = new Set<string>();
  for (const m of MILESTONES) if (meets(d, m.requires)) out.add(m.id);
  return out;
}

/**
 * The highest stage whose requirement is met.
 *
 * Stages 1-3 key off *consistency* (days recorded) and only the last off coin —
 * see DECISIONS.md. That is what makes the world change on the very first
 * recorded purchase instead of months later.
 */
export function computeStage(d: Derived): StageDef {
  let best = STAGES[0];
  for (const s of STAGES) if (meets(d, s.requires) && s.stage >= best.stage) best = s;
  return best;
}

/** All grant tokens implied by a set of unlocked milestone ids. */
export function grantsOf(unlocks: ReadonlySet<string>): Set<Grant> {
  const out = new Set<Grant>();
  for (const m of MILESTONES) if (unlocks.has(m.id)) for (const g of m.grants) out.add(g);
  return out;
}

/**
 * unlocks -> worldState. Pure.
 *
 * Grant grammar (AUDIT §6):
 *   "prop.<id>"            make that prop visible
 *   "prop.<id>:<variant>"  swap that prop's sprite to `prop_<id>_<variant>`
 *   "entity.<kind>"        spawn that entity
 */
export function computeWorldState(d: Derived): WorldState {
  const stage = computeStage(d);
  const grants = grantsOf(computeUnlocks(d));

  const visibleProps = new Set<string>();
  const propVariants: Record<string, string> = {};
  const activeEntities = new Set<string>();

  for (const g of grants) {
    if (g.startsWith("entity.")) {
      activeEntities.add(g.slice("entity.".length));
      continue;
    }
    if (!g.startsWith("prop.")) continue;
    const body = g.slice("prop.".length);
    const [id, variant] = body.split(":");
    visibleProps.add(id);
    if (variant) propVariants[id] = `prop_${id}_${variant}`;
  }

  return {
    stage: stage.stage,
    stageLabel: stage.label,
    homeSprite: stage.home,
    visibleProps,
    propVariants,
    activeEntities,
  };
}

/**
 * Milestone notifications come from a DIFF, not an event (L5 / AUDIT §6).
 *
 * Backfilling six months at once must produce ONE summary, not twenty popups —
 * which is only possible if "new" means "in unlocks but not in lastSeenUnlocks",
 * computed after the recompute, rather than something fired during insertion.
 */
export function newlyUnlocked(
  unlocks: ReadonlySet<string>,
  lastSeen: ReadonlySet<string>,
): Milestone[] {
  return MILESTONES.filter((m) => unlocks.has(m.id) && !lastSeen.has(m.id));
}
