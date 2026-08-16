import { PALETTE as P } from "../core/palette";
import { drawText, textWidth } from "./font";

/**
 * Diegetic HUD (ASSET_SPEC §7), drawn to a plain 2D canvas — no engine needed.
 *
 * Carved wooden signs and a notched gauge, drawn pixel-by-pixel: no border-radius,
 * no box-shadow, no rgba translucency, no blur, no system font. Those five are
 * what make a pixel UI read as a dashboard.
 *
 * Content is ASCII only (L10). The Thai lives in the HTML layer around this canvas.
 */

export const HUD_W = 360;
export const HUD_H = 116;

export type HudModel = {
  /** Total accumulated, as a fraction of the world goal (0..1). No streak — this
   *  world is built for lump-sum accumulation, not daily habit (see DECISIONS.md). */
  progressToGoal: number;
  totalSats: number;
  goalSats: number;
  sceneLabel: string;
  /** ASCII caption for what the gauge is filling toward, e.g. "NEXT 0.05 BTC". */
  nextLabel: string;
  progressToNext: number;
};

class Px {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;

  constructor(w: number, h: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const g = this.canvas.getContext("2d");
    if (!g) throw new Error("2d context unavailable");
    g.imageSmoothingEnabled = false;
    this.g = g;
  }

  clear(): void {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  r(x: number, y: number, w: number, h: number, c: string): void {
    this.g.fillStyle = c;
    this.g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
  }

  text(s: string, x: number, y: number, c: string): void {
    drawText(s, x, y, (px, py) => this.r(px, py, 1, 1, c));
  }
}

/** A 9-slice wooden panel: 4px border, hard pixel corners, light from top-left. */
function panel(px: Px, x: number, y: number, w: number, h: number): void {
  px.r(x, y, w, h, P.wood[1]);
  px.r(x + 2, y + 2, w - 4, h - 4, P.wood[2]);
  px.r(x + 4, y + 4, w - 8, h - 8, P.wood[1]);
  px.r(x, y, w, 2, P.wood[3]);
  px.r(x, y, 2, h, P.wood[3]);
  px.r(x, y + h - 2, w, 2, P.wood[0]);
  px.r(x + w - 2, y, 2, h, P.wood[0]);
  px.r(x, y, 2, 2, P.wood[0]);
  px.r(x + w - 2, y, 2, 2, P.wood[0]);
  px.r(x, y + h - 2, 2, 2, P.wood[0]);
  px.r(x + w - 2, y + h - 2, 2, 2, P.wood[0]);
}

/** A carved trough with notched segments — not a rounded bar, not a percentage ring. */
function gauge(px: Px, x: number, y: number, w: number, progress: number, segments = 4): void {
  const h = 9;
  px.r(x, y, w, h, P.wood[0]);
  px.r(x + 1, y + 1, w - 2, h - 2, P.dirt[0]);
  const inner = w - 4;
  const segW = Math.floor((inner - (segments - 1)) / segments);
  const clamped = Math.max(0, Math.min(1, progress));
  const filledPx = Math.round(inner * clamped);
  let drawn = 0;
  for (let s = 0; s < segments; s++) {
    const sx = x + 2 + s * (segW + 1);
    const fill = Math.max(0, Math.min(segW, filledPx - drawn));
    if (fill > 0) {
      px.r(sx, y + 2, fill, h - 4, P.grass[2]);
      px.r(sx, y + 2, fill, 1, P.grass[4]);
    }
    drawn += segW;
  }
}

export function drawHud(px: Px, m: HudModel): void {
  px.clear();

  panel(px, 0, 0, HUD_W, 30);
  const title = "BTC HOMESTEAD";
  px.text(title, Math.round((HUD_W - textWidth(title)) / 2), 11, P.gold[4]);

  panel(px, 8, 36, 224, 68);
  const btc = `${(m.totalSats / 100_000_000).toFixed(8)} BTC`;
  px.text(btc, 18, 46, P.gold[4]);

  gauge(px, 18, 58, 204, m.progressToGoal);
  px.text(`${Math.round(m.progressToGoal * 100)}% OF GOAL`, 18, 71, P.wood[4]);

  px.text(m.nextLabel.slice(0, 33), 18, 84, P.grass[4]);
}

/** Owns the HUD canvas and redraws only when the model actually changes. */
export class Hud {
  private readonly px = new Px(HUD_W, HUD_H);
  private last = "";
  readonly canvas: HTMLCanvasElement = this.px.canvas;

  update(m: HudModel): boolean {
    const key = JSON.stringify(m);
    if (key === this.last) return false;
    this.last = key;
    drawHud(this.px, m);
    return true;
  }
}
