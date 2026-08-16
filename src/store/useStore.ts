import { create } from "zustand";
import { buildBackup, parseBackup, serializeBackup } from "../core/backup";
import { todayKey } from "../core/date";
import { derive } from "../core/derive";
import { computeUnlocks, computeWorldState, newlyUnlocked } from "../core/progression";
import type { Derived, Entry, Milestone, WorldState } from "../core/types";
import { db, readMeta, writeMeta } from "../db/db";

const LAST_SEEN_KEY = "lastSeenUnlocks";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

type State = {
  ready: boolean;
  entries: Entry[];
  derived: Derived;
  unlocks: Set<string>;
  world: WorldState;
  lastSeenUnlocks: Set<string>;
  /** Milestones crossed since the user last looked. Batched, never per-entry. */
  pendingUnlocks: Milestone[];

  load: () => Promise<void>;
  addEntry: (e: Omit<Entry, "id">) => Promise<Entry>;
  updateEntry: (id: string, patch: Partial<Omit<Entry, "id">>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  acknowledgeUnlocks: () => Promise<void>;
  exportJson: () => string;
  importJson: (text: string, mode: "replace" | "merge") => Promise<number>;
};

const EMPTY = derive([], todayKey());

export const useStore = create<State>((set, get) => {
  /** The whole pipeline, in one place. Called after every mutation (L5). */
  const recompute = (entries: Entry[], lastSeen: Set<string>) => {
    const d = derive(entries, todayKey());
    const unlocks = computeUnlocks(d);
    return {
      entries,
      derived: d,
      unlocks,
      world: computeWorldState(d),
      lastSeenUnlocks: lastSeen,
      pendingUnlocks: newlyUnlocked(unlocks, lastSeen),
    };
  };

  const persistAndRecompute = async (entries: Entry[]) => {
    set(recompute(entries, get().lastSeenUnlocks));
  };

  return {
    ready: false,
    entries: [],
    derived: EMPTY,
    unlocks: new Set(),
    world: computeWorldState(EMPTY),
    lastSeenUnlocks: new Set(),
    pendingUnlocks: [],

    async load() {
      const [entries, seen] = await Promise.all([
        db.entries.toArray(),
        readMeta<string[]>(LAST_SEEN_KEY, []),
      ]);
      set({ ...recompute(entries, new Set(seen)), ready: true });
    },

    async addEntry(input) {
      const entry: Entry = { ...input, id: newId() };
      await db.entries.add(entry);
      await persistAndRecompute([...get().entries, entry]);
      return entry;
    },

    async updateEntry(id, patch) {
      const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      const changed = next.find((e) => e.id === id);
      if (!changed) return;
      await db.entries.put(changed);
      await persistAndRecompute(next);
    },

    async deleteEntry(id) {
      await db.entries.delete(id);
      await persistAndRecompute(get().entries.filter((e) => e.id !== id));
    },

    async acknowledgeUnlocks() {
      const seen = new Set(get().unlocks);
      await writeMeta(LAST_SEEN_KEY, [...seen]);
      set({ lastSeenUnlocks: seen, pendingUnlocks: [] });
    },

    exportJson() {
      const s = get();
      return serializeBackup(
        buildBackup(s.entries, [...s.lastSeenUnlocks], new Date().toISOString()),
      );
    },

    async importJson(text, mode) {
      const backup = parseBackup(text);
      if (mode === "replace") {
        await db.transaction("rw", db.entries, db.meta, async () => {
          await db.entries.clear();
          await db.entries.bulkAdd(backup.entries);
          await writeMeta(LAST_SEEN_KEY, backup.lastSeenUnlocks);
        });
        set({ lastSeenUnlocks: new Set(backup.lastSeenUnlocks) });
        await persistAndRecompute(backup.entries);
        return backup.entries.length;
      }

      // merge: existing ids win, so re-importing the same file is a no-op.
      const existing = new Map(get().entries.map((e) => [e.id, e]));
      const added = backup.entries.filter((e) => !existing.has(e.id));
      if (added.length) await db.entries.bulkAdd(added);
      await persistAndRecompute([...get().entries, ...added]);
      return added.length;
    },
  };
});

// Dev-only handle, so the ledger pipeline can be exercised from the console
// (backfill batching, import/export round trips) without a UI harness.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__store = useStore;
}
