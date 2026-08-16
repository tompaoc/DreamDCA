import { describe, expect, it } from "vitest";
import {
  addDays,
  dayRange,
  daysBetween,
  isValidDay,
  isoLocal,
  parseDay,
} from "../src/core/date";

const TZ = process.env.TZ ?? "(system default)";

describe(`date utils [TZ=${TZ}]`, () => {
  it("uses the LOCAL calendar day, not the UTC one", () => {
    // 14 Aug 2026, 09:00 local. In Sydney (UTC+10) this instant is 13 Aug in UTC,
    // which is exactly how the streak counter started skipping days.
    const d = new Date(2026, 7, 14, 9, 0, 0);
    expect(isoLocal(d)).toBe("2026-08-14");
  });

  it("is stable at both ends of the local day", () => {
    expect(isoLocal(new Date(2026, 7, 14, 0, 0, 0))).toBe("2026-08-14");
    expect(isoLocal(new Date(2026, 7, 14, 23, 59, 59))).toBe("2026-08-14");
  });

  it("never agrees with the toISOString() shortcut by accident", () => {
    // Not asserting they differ — in UTC they must agree. Asserting isoLocal is
    // right regardless of which timezone the test runs in.
    const d = new Date(2026, 0, 1, 8, 30);
    expect(isoLocal(d)).toBe("2026-01-01");
  });

  it("round-trips through parseDay", () => {
    for (const k of ["2026-01-01", "2026-02-28", "2026-08-14", "2027-12-31"]) {
      expect(isoLocal(parseDay(k))).toBe(k);
    }
  });

  it("counts whole days across a month boundary", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-02-01", "2026-01-31")).toBe(-1);
    expect(daysBetween("2026-08-14", "2026-08-14")).toBe(0);
  });

  it("counts whole days across a leap day", () => {
    // 2028 is the next leap year; 2026 and 2027 are not.
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("counts whole days across every DST transition of 2026", () => {
    // Sydney: 5 Apr (out), 4 Oct (in). Los Angeles: 8 Mar (in), 1 Nov (out).
    // EU: 29 Mar (in), 25 Oct (out). Whichever timezone this runs under, a
    // transition day is still exactly one calendar day long.
    const transitions = [
      ["2026-03-07", "2026-03-09"],
      ["2026-03-28", "2026-03-30"],
      ["2026-04-04", "2026-04-06"],
      ["2026-10-03", "2026-10-05"],
      ["2026-10-24", "2026-10-26"],
      ["2026-10-31", "2026-11-02"],
    ];
    for (const [a, b] of transitions) {
      expect(daysBetween(a, b), `${a} -> ${b}`).toBe(2);
      expect(addDays(a, 2), `${a} + 2`).toBe(b);
    }
  });

  it("walks a two-year range one day at a time without drifting", () => {
    const days = dayRange("2026-01-01", "2027-12-31");
    expect(days.length).toBe(730); // 2026 and 2027 are both 365-day years
    expect(days[0]).toBe("2026-01-01");
    expect(days[days.length - 1]).toBe("2027-12-31");
    expect(new Set(days).size).toBe(730); // no repeats, no skips
  });

  it("rejects malformed and non-existent days", () => {
    expect(isValidDay("2026-08-14")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("2026-8-14")).toBe(false);
    expect(isValidDay("14/08/2026")).toBe(false);
  });
});
