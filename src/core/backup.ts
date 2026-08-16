import { isValidDay } from "./date";
import type { Entry } from "./types";

/**
 * JSON export / import.
 *
 * HANDOFF.md calls this "the single most important item" before the app can be
 * used for real: the ledger currently lives in one browser's IndexedDB, and
 * clearing site data would destroy a two-year record with no way back.
 */

export const BACKUP_FORMAT = "dreamdca.ledger";
export const BACKUP_VERSION = 2;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  world: string;
  entries: Entry[];
  /** Highest scene id the user has already seen the unlock summary for, or null. */
  lastSeenSceneId: string | null;
};

export class ImportError extends Error {}

export function buildBackup(
  entries: readonly Entry[],
  lastSeenSceneId: string | null,
  exportedAt: string,
  world = "btc",
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    world,
    entries: [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    lastSeenSceneId,
  };
}

export const serializeBackup = (b: Backup): string => JSON.stringify(b, null, 2);

/**
 * Parse and validate a backup. Every field is checked, because the failure mode
 * of a lenient importer is a savings record that looks fine and is silently wrong.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้");
  }
  if (typeof raw !== "object" || raw === null) throw new ImportError("ไฟล์เสียหาย");

  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) throw new ImportError("ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Dream DCA");
  if (typeof o.version !== "number" || o.version > BACKUP_VERSION) {
    throw new ImportError(`ไฟล์สำรองเวอร์ชัน ${String(o.version)} ใหม่เกินกว่าที่แอปนี้อ่านได้`);
  }
  if (!Array.isArray(o.entries)) throw new ImportError("ไม่พบรายการบันทึกในไฟล์");

  const seen = new Set<string>();
  const entries: Entry[] = o.entries.map((item, i) => {
    const e = item as Record<string, unknown>;
    const where = `รายการที่ ${i + 1}`;
    if (typeof e.id !== "string" || !e.id) throw new ImportError(`${where}: id ไม่ถูกต้อง`);
    if (seen.has(e.id)) throw new ImportError(`${where}: id ซ้ำ (${e.id})`);
    seen.add(e.id);
    if (typeof e.date !== "string" || !isValidDay(e.date)) {
      throw new ImportError(`${where}: วันที่ไม่ถูกต้อง (${String(e.date)})`);
    }
    for (const k of ["sats", "fiatCents"] as const) {
      const v = e[k];
      if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
        throw new ImportError(`${where}: ${k} ต้องเป็นจำนวนเต็มไม่ติดลบ (พบ ${String(v)})`);
      }
    }
    if (e.note !== undefined && typeof e.note !== "string") {
      throw new ImportError(`${where}: note ต้องเป็นข้อความ`);
    }
    return {
      id: e.id,
      date: e.date,
      sats: e.sats as number,
      fiatCents: e.fiatCents as number,
      ...(e.note ? { note: e.note as string } : {}),
    };
  });

  const lastSeenSceneId =
    typeof o.lastSeenSceneId === "string"
      ? o.lastSeenSceneId
      : Array.isArray(o.lastSeenUnlocks) // v1 backups: no scene concept, treat as unseen
        ? null
        : null;

  return {
    format: BACKUP_FORMAT,
    version: o.version,
    exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : "",
    world: typeof o.world === "string" ? o.world : "btc",
    entries,
    lastSeenSceneId,
  };
}
