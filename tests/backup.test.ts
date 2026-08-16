import { describe, expect, it } from "vitest";
import { ImportError, buildBackup, parseBackup, serializeBackup } from "../src/core/backup";
import { derive } from "../src/core/derive";
import type { Entry } from "../src/core/types";

const ENTRIES: Entry[] = [
  { id: "b", date: "2026-02-19", sats: 14000, fiatCents: 934, note: "ครั้งแรก" },
  { id: "a", date: "2026-01-04", sats: 250_000, fiatCents: 15_000 },
];

const round = (e: Entry[], seen: string | null = null) =>
  parseBackup(serializeBackup(buildBackup(e, seen, "2026-08-14T00:00:00.000Z")));

describe("export / import — the single most important item before real use", () => {
  it("survives a full round trip byte-for-byte in meaning", () => {
    const back = round(ENTRIES, "first_light");
    expect(back.entries).toHaveLength(2);
    expect(back.lastSeenSceneId).toBe("first_light");
    // Derived state must be identical, which is the actual thing the user cares about.
    expect(derive(back.entries, "2026-08-14")).toEqual(derive(ENTRIES, "2026-08-14"));
  });

  it("sorts entries by date on export so diffs stay readable", () => {
    expect(round(ENTRIES).entries.map((e) => e.date)).toEqual(["2026-01-04", "2026-02-19"]);
  });

  it("preserves Thai notes", () => {
    expect(round(ENTRIES).entries.find((e) => e.id === "b")?.note).toBe("ครั้งแรก");
  });

  it("rejects a file that is not ours", () => {
    expect(() => parseBackup('{"format":"something-else","version":1,"entries":[]}')).toThrow(
      ImportError,
    );
    expect(() => parseBackup("not json at all")).toThrow(ImportError);
  });

  it("refuses a backup from a newer version rather than guessing", () => {
    const b = buildBackup(ENTRIES, null, "x");
    const text = JSON.stringify({ ...b, version: 99 });
    expect(() => parseBackup(text)).toThrow(/ใหม่เกิน/);
  });

  it("rejects corrupted numbers instead of importing a wrong balance", () => {
    const bad = (patch: Record<string, unknown>) =>
      JSON.stringify({
        ...buildBackup([{ ...ENTRIES[0], ...patch } as Entry], null, "x"),
      });
    expect(() => parseBackup(bad({ sats: 1.5 }))).toThrow(ImportError);
    expect(() => parseBackup(bad({ sats: -1 }))).toThrow(ImportError);
    expect(() => parseBackup(bad({ fiatCents: "934" }))).toThrow(ImportError);
    expect(() => parseBackup(bad({ date: "2026-02-30" }))).toThrow(ImportError);
    expect(() => parseBackup(bad({ date: "19/02/2026" }))).toThrow(ImportError);
  });

  it("rejects duplicate ids, which would double-count a purchase", () => {
    const text = JSON.stringify(buildBackup([ENTRIES[0], { ...ENTRIES[0] }], null, "x"));
    expect(() => parseBackup(text)).toThrow(/ซ้ำ/);
  });

  it("treats a v1 backup (no scene concept) as unseen rather than guessing", () => {
    const v1 = JSON.stringify({
      format: "dreamdca.ledger",
      version: 1,
      exportedAt: "x",
      world: "btc",
      entries: [],
      lastSeenUnlocks: ["first_light", "steady_3"],
    });
    expect(parseBackup(v1).lastSeenSceneId).toBeNull();
  });
});
