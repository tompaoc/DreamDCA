import { describe, expect, it } from "vitest";
import {
  MoneyError,
  btcToSats,
  centsToFiat,
  decimalToInt,
  fiatToCents,
  formatFiat,
  intToDecimal,
  priceCentsPerBtc,
  satsFor,
  satsToBtc,
} from "../src/core/money";

describe("integer money (L6)", () => {
  it("parses BTC decimals without touching a float", () => {
    // parseFloat("0.00014") * 1e8 === 14000.000000000002 — this is the whole point.
    expect(btcToSats("0.00014")).toBe(14000);
    expect(btcToSats("0.1")).toBe(10_000_000);
    expect(btcToSats("0.2")).toBe(20_000_000);
    expect(btcToSats("1")).toBe(100_000_000);
    expect(btcToSats("21000000")).toBe(2_100_000_000_000_000);
  });

  it("survives the 0.1 + 0.2 case exactly", () => {
    expect(btcToSats("0.1") + btcToSats("0.2")).toBe(btcToSats("0.3"));
  });

  it("round-trips every value it parses", () => {
    for (const s of ["0.00013986", "0.00000001", "12.34567891", "0.1", "5"]) {
      expect(satsToBtc(btcToSats(s), true)).toBe(s.includes(".") ? s.replace(/0+$/, "") : s);
    }
  });

  it("rejects rather than silently rounding away precision", () => {
    expect(() => btcToSats("0.000000001")).toThrow(MoneyError); // 9dp
    expect(() => fiatToCents("9.345")).toThrow(MoneyError); // 3dp
    expect(() => btcToSats("abc")).toThrow(MoneyError);
    expect(() => btcToSats("")).toThrow(MoneyError);
    expect(() => btcToSats("-1")).toThrow(MoneyError);
  });

  it("tolerates the ways people actually type numbers", () => {
    expect(fiatToCents(" 1,234.50 ")).toBe(123_450);
    expect(fiatToCents(".5")).toBe(50);
    expect(fiatToCents("7.")).toBe(700);
  });

  it("formats cents back for display", () => {
    expect(centsToFiat(934)).toBe("9.34");
    expect(formatFiat(934)).toBe("$9.34");
    expect(formatFiat(766_531_00)).toBe("$766,531.00");
    expect(intToDecimal(14000, 8, true)).toBe("0.00014");
  });

  it("computes sats bought for a fiat amount at a price", () => {
    // The one real BTC trade in the history: $9.34 @ $66,700 -> 0.00014 BTC.
    const sats = satsFor(fiatToCents("9.34"), fiatToCents("66700"));
    expect(sats).toBe(14003);
    expect(satsToBtc(sats, true)).toBe("0.00014003");
  });

  it("derives the price paid instead of storing it", () => {
    const price = priceCentsPerBtc(fiatToCents("9.34"), btcToSats("0.00014"));
    expect(centsToFiat(price)).toBe("66714.29");
  });

  it("keeps satsFor and priceCentsPerBtc consistent to within one satoshi of granularity", () => {
    // Rounding to a whole satoshi moves the implied price by up to one "sat step"
    // (price/sats cents). On a $100 buy that step is ~41 cents, so asserting the
    // price round-trips to the cent would be asserting something untrue.
    const price = fiatToCents("64321.55");
    for (const amount of ["100.00", "1000.00", "25000.00"]) {
      const fiat = fiatToCents(amount);
      const sats = satsFor(fiat, price);
      const step = Math.ceil(price / sats);
      expect(Math.abs(priceCentsPerBtc(fiat, sats) - price), amount).toBeLessThanOrEqual(step + 1);
    }
    // A large enough buy pins the price exactly.
    const big = fiatToCents("25000.00");
    expect(priceCentsPerBtc(big, satsFor(big, price))).toBe(price);
  });

  it("returns 0 price for a zero-sat position rather than dividing by zero", () => {
    expect(priceCentsPerBtc(1000, 0)).toBe(0);
    expect(() => satsFor(1000, 0)).toThrow(MoneyError);
  });

  it("refuses values beyond exact integer range", () => {
    expect(() => decimalToInt("99999999999999999999", 8)).toThrow(MoneyError);
  });
});
