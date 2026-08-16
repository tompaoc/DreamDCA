import { useState } from "react";
import { daysInMonth, firstWeekdayOfMonth, todayKey } from "../core/date";
import { formatBtc, formatFiat } from "../core/money";
import type { Entry } from "../core/types";
import { useStore } from "../store/useStore";
import { Sheet } from "./Sheet";

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** The recording window the app is built around. */
const FIRST = { y: 2026, m: 1 };
const LAST = { y: 2027, m: 12 };

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Month view over 2026-2027, tap any day to backfill.
 *
 * Backfill is not a special path: inserting an old entry is the same recompute
 * as inserting today's, because the whole pipeline is a pure function of the
 * ledger (L5). That is the entire reason this screen is cheap to build.
 */
export function CalendarSheet({
  onClose,
  onPickDay,
  onEditEntry,
}: {
  onClose: () => void;
  onPickDay: (day: string) => void;
  onEditEntry: (entry: Entry) => void;
}) {
  const derived = useStore((s) => s.derived);
  const entries = useStore((s) => s.entries);

  const today = todayKey();
  const [y, setY] = useState(() => Number(today.slice(0, 4)) || FIRST.y);
  const [m, setM] = useState(() => Number(today.slice(5, 7)) || FIRST.m);
  const [selected, setSelected] = useState<string | null>(null);

  const clamp = (yy: number, mm: number) => {
    const v = yy * 12 + (mm - 1);
    const lo = FIRST.y * 12 + (FIRST.m - 1);
    const hi = LAST.y * 12 + (LAST.m - 1);
    const c = Math.min(hi, Math.max(lo, v));
    setY(Math.floor(c / 12));
    setM((c % 12) + 1);
  };

  const total = daysInMonth(y, m);
  const offset = firstWeekdayOfMonth(y, m);
  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const dayEntries = selected ? entries.filter((e) => e.date === selected) : [];

  return (
    <Sheet title="ปฏิทินการบันทึก" onClose={onClose}>
      <div className="cal-nav">
        <button type="button" className="btn" onClick={() => clamp(y, m - 1)}>
          ‹
        </button>
        <b>
          {MONTHS_TH[m - 1]} {y + 543}
        </b>
        <button type="button" className="btn" onClick={() => clamp(y, m + 1)}>
          ›
        </button>
      </div>

      <div className="cal-grid cal-head">
        {WEEKDAYS_TH.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={`pad${i}`} className="cal-cell cal-pad" />;
          const k = key(y, m, d);
          const rec = derived.byDay[k];
          const classes = [
            "cal-cell",
            rec ? "has" : "",
            k === today ? "today" : "",
            k === selected ? "sel" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button type="button" key={k} className={classes} onClick={() => setSelected(k)}>
              {d}
              {rec ? <i className="dot" /> : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="cal-detail">
          <div className="cal-detail-head">
            <b>{selected}</b>
            <button type="button" className="btn btn-primary" onClick={() => onPickDay(selected)}>
              + เพิ่มรายการวันนี้
            </button>
          </div>
          {dayEntries.length === 0 ? (
            <p className="muted">ยังไม่มีการบันทึกในวันนี้</p>
          ) : (
            <ul className="entry-list">
              {dayEntries.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onEditEntry(e)}>
                    <b>{formatBtc(e.sats)} BTC</b>
                    <span>{formatFiat(e.fiatCents)}</span>
                    {e.note ? <small>{e.note}</small> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="muted">แตะวันที่เพื่อดูหรือย้อนบันทึก</p>
      )}
    </Sheet>
  );
}
