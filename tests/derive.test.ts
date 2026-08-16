import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/date";
import { currentStreak, derive } from "../src/core/derive";
import { btcToSats, centsToFiat, fiatToCents } from "../src/core/money";
import type { Entry } from "../src/core/types";

let n = 0;
const entry = (date: string, btc: string, fiat: string): Entry => ({
  id: `e${n++}`,
  date,
  sats: btcToSats(btc),
  fiatCents: fiatToCents(fiat),
});

describe("derive (L5 — the ledger is the only source of truth)", () => {
  it("is empty and total for an empty ledger", () => {
    const d = derive([], "2026-08-14");
    expect(d).toMatchObject({
      totalSats: 0,
      totalFiatCents: 0,
      avgCostCentsPerBtc: 0,
      daysRecorded: 0,
      streak: 0,
      longestStreak: 0,
      entryCount: 0,
      firstDay: null,
      lastDay: null,
    });
  });

  it("sums the real BTC history — one trade, ever", () => {
    const d = derive([entry("2026-02-19", "0.00014", "9.34")], "2026-08-14");
    expect(d.totalSats).toBe(14000);
    expect(d.totalFiatCents).toBe(934);
    expect(centsToFiat(d.avgCostCentsPerBtc)).toBe("66714.29");
    expect(d.daysRecorded).toBe(1);
    expect(d.firstDay).toBe("2026-02-19");
  });

  it("weights average cost by size, not by count", () => {
    const d = derive(
      [entry("2026-01-01", "0.01", "300.00"), entry("2026-01-02", "0.09", "3600.00")],
      "2026-01-02",
    );
    // 3900.00 / 0.1 BTC = 39,000 per BTC — not the 19,500 a naive mean would give.
    expect(centsToFiat(d.avgCostCentsPerBtc)).toBe("39000.00");
  });

  it("collapses several entries on one day into one recorded day", () => {
    const d = derive(
      [
        entry("2026-08-14", "0.001", "60.00"),
        entry("2026-08-14", "0.002", "120.00"),
        entry("2026-08-13", "0.001", "60.00"),
      ],
      "2026-08-14",
    );
    expect(d.entryCount).toBe(3);
    expect(d.daysRecorded).toBe(2);
    expect(d.byDay["2026-08-14"]).toEqual({ sats: 300_000, fiatCents: 18_000, count: 2 });
  });

  it("gives the same result whatever order the entries arrive in — backfill is free", () => {
    const days = ["2026-03-01", "2026-01-15", "2026-02-20", "2026-01-16"];
    const made = days.map((d) => entry(d, "0.001", "60.00"));
    const forward = derive(made, "2026-03-01");
    const backward = derive([...made].reverse(), "2026-03-01");
    expect(backward).toEqual(forward);
  });

  it("counts a streak ending today", () => {
    const days = ["2026-08-12", "2026-08-13", "2026-08-14"];
    expect(derive(days.map((d) => entry(d, "0.001", "60.00")), "2026-08-14").streak).toBe(3);
  });

  it("does not break a streak just because today has not been recorded yet", () => {
    // Opening the app at 8am before buying must not read as a broken streak.
    const days = ["2026-08-12", "2026-08-13"];
    expect(derive(days.map((d) => entry(d, "0.001", "60.00")), "2026-08-14").streak).toBe(2);
  });

  it("breaks the streak once a whole day is missed", () => {
    const days = ["2026-08-10", "2026-08-11"];
    expect(derive(days.map((d) => entry(d, "0.001", "60.00")), "2026-08-14").streak).toBe(0);
  });

  it("reports the longest historical streak independently of the current one", () => {
    const days = [
      "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", // 4 in a row
      "2026-06-01", "2026-06-02", // then a 2
    ];
    const d = derive(days.map((x) => entry(x, "0.001", "60.00")), "2026-08-14");
    expect(d.longestStreak).toBe(4);
    expect(d.streak).toBe(0);
  });

  it("walks a 400-day streak across month, year and leap boundaries", () => {
    const days: string[] = [];
    let k = "2027-06-20";
    for (let i = 0; i < 400; i++) {
      days.push(k);
      k = addDays(k, -1);
    }
    const d = derive(days.map((x) => entry(x, "0.0001", "6.00")), "2027-06-20");
    expect(d.streak).toBe(400);
    expect(d.daysRecorded).toBe(400);
  });

  it("currentStreak handles the empty set", () => {
    expect(currentStreak(new Set(), "2026-08-14")).toBe(0);
  });
});
