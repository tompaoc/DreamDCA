import Dexie, { type Table } from "dexie";
import type { Entry } from "../core/types";

/**
 * IndexedDB persistence. Autosave only — no slots, no cloud (AUDIT §7).
 *
 * The ledger table is append-mostly and small: even two years of daily buys is
 * ~730 rows, so everything is read into memory once at boot and the pure
 * pipeline runs over the array.
 */
export class DreamDcaDb extends Dexie {
  entries!: Table<Entry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = "dreamdca") {
    super(name);
    this.version(1).stores({
      entries: "id, date",
      meta: "key",
    });
  }
}

export const db = new DreamDcaDb();

export async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
