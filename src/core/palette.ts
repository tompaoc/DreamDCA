/**
 * The 48-colour master palette (art/dreamdca-48.gpl), transcribed.
 *
 * L9: this file and the .gpl must never disagree. `npm run validate:art` checks
 * shipped PNGs against the .gpl; this module exists so procedural placeholder art
 * is on-palette too, and so a placeholder never quietly teaches the eye a colour
 * the real artist cannot use.
 */

export const PALETTE = {
  ink: ["#140F14", "#241A21", "#3A2B33"],
  grass: ["#2E5227", "#3F6E2E", "#57913A", "#77B24A", "#9CCB63"],
  foliage: ["#16351F", "#20502C", "#2F6E38", "#478C42"],
  dirt: ["#3A2410", "#573418", "#7A4C22", "#9C6A34", "#C08F51"],
  stone: ["#2C2A2E", "#474550", "#6A6672", "#9A96A0"],
  wood: ["#3B2109", "#5B3311", "#7E4A1B", "#A3682B", "#C68F45"],
  water: ["#0E2E52", "#17497F", "#2470B4", "#3E9BD8", "#8CD3EE"],
  gold: ["#5C3405", "#96600C", "#D2951A", "#F5C13C", "#FFE79A"],
  skin: ["#6B3B2A", "#B36A45", "#E8B283"],
  accent: ["#701B2E", "#C4383F", "#EE8A55"],
  cloth: ["#181A24", "#2F374F", "#5C6B94"],
  bloom: ["#B23F9C", "#EE9AD6", "#FFF4C2"],
} as const;

export type Ramp = keyof typeof PALETTE;

/** Every palette colour, flat. Length must be 48. */
export const PALETTE_FLAT: readonly string[] = Object.values(PALETTE).flat();

/** "#RRGGBB" -> 0xRRGGBB, for Phaser's numeric colour APIs. */
export const hex = (c: string): number => parseInt(c.slice(1), 16);

/** Shorthand: `p("grass", 2)` -> "#57913A". */
export const p = (ramp: Ramp, i: number): string => PALETTE[ramp][i];

/** Shorthand returning a Phaser-friendly number. */
export const pn = (ramp: Ramp, i: number): number => hex(PALETTE[ramp][i]);
