import { describe, expect, it } from "vitest";
import { DESIGN_H, DESIGN_W, computeViewport } from "../src/game/scale";

/** Real devices, CSS px (portrait). */
const DEVICES: Array<[string, number, number, number]> = [
  // name, vw, vh, expected integer scale
  ["iPhone 12/13/14 (390x844)", 390, 844, 1],
  ["iPhone 14 Pro Max (430x932)", 430, 932, 1],
  ["iPhone SE (375x667)", 375, 667, 1],
  ["Pixel 7 (412x915)", 412, 915, 1],
  ["Galaxy S8 (360x740)", 360, 740, 1],
  ["iPad mini (744x1133)", 744, 1133, 1],
  ["iPad Pro 11 (834x1194)", 834, 1194, 1],
  ["Desktop window (1280x1440)", 1280, 1440, 2],
  ["Big desktop (1920x2160)", 1920, 2160, 3],
];

describe("integer scaling (L3)", () => {
  it.each(DEVICES)("%s scales to an integer", (_name, vw, vh, expected) => {
    const v = computeViewport(vw, vh);
    expect(v.scale).toBe(expected);
    expect(Number.isInteger(v.scale)).toBe(true);
  });

  it("never produces a fractional scale, at any viewport in a wide sweep", () => {
    for (let vw = 240; vw <= 2400; vw += 7) {
      for (let vh = 400; vh <= 2400; vh += 13) {
        const v = computeViewport(vw, vh);
        expect(Number.isInteger(v.scale)).toBe(true);
        expect(Number.isInteger(v.internalW)).toBe(true);
        expect(Number.isInteger(v.internalH)).toBe(true);
        // CSS size is exactly an integer multiple of the backing store.
        expect(v.cssW).toBe(v.internalW * v.scale);
        expect(v.cssH).toBe(v.internalH * v.scale);
      }
    }
  });

  it("never scales below 1x, even on a viewport smaller than the design", () => {
    expect(computeViewport(320, 480).scale).toBe(1);
    expect(computeViewport(100, 100).scale).toBe(1);
  });

  it("extends vertically instead of letterboxing", () => {
    // 390x844 at 1x: the design is 640 tall, the screen is 844 -> 204 extra rows
    // of world, not 204px of black bar.
    const v = computeViewport(390, 844);
    expect(v.internalH).toBe(844);
    expect(v.extraRows).toBe(204);
    expect(v.internalH).toBeGreaterThanOrEqual(DESIGN_H);
  });

  it("keeps the design height as a floor on short viewports", () => {
    const v = computeViewport(390, 500);
    expect(v.internalH).toBe(DESIGN_H);
  });

  it("never renders wider than the viewport", () => {
    for (const [, vw, vh] of DEVICES) {
      const v = computeViewport(vw, vh);
      expect(v.cssW).toBeLessThanOrEqual(vw);
    }
  });

  it("keeps the internal width pinned to the design width", () => {
    for (const [, vw, vh] of DEVICES) {
      expect(computeViewport(vw, vh).internalW).toBe(DESIGN_W);
    }
  });

  it("hits exactly 3x on a 390x844 DPR-3 phone in device pixels", () => {
    // The claim in L3: 360x640 renders at exactly 3x = 1080x1920 device px.
    // In CSS px that is 1x; the DPR-3 screen supplies the other 3x for free
    // because the canvas is nearest-neighbour and the transform is integer.
    const v = computeViewport(390, 844);
    const dpr = 3;
    expect(v.cssW * dpr).toBe(1080);
    expect(DESIGN_H * v.scale * dpr).toBe(1920);
  });
});
