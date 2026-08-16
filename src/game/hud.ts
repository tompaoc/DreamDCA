import type Phaser from "phaser";
import { PALETTE as P } from "../core/palette";
import { drawText, textWidth } from "./font";

/**
 * Diegetic HUD (ASSET_SPEC §7).
 *
 * Carved wooden signs and a notched gauge, drawn pixel-by-pixel: no border-radius,
 * no box-shadow, no rgba translucency, no blur, no system font. Those five are
 * what make a pixel UI read as a dashboard, which is the failure mode the whole
 * brief is organised against.
 *
 * Content is ASCII only, per L10. The Thai lives in the HTML layer.
 */

export const HUD_W = 360;
export const HUD_H = 116;
const HUD_KEY = "ui_hud";

export type HudModel = {
  /** Headline metric. Streak, not BTC-to-goal — see DECISIONS.md §4.1. */
  streak: number;
  daysRecorded: number;
  totalSats: number;
  stage: number;
  /** 0..1 progress toward the next milestone, for the notched gauge. */
  nextProgress: number;
  /** ASCII caption for what the gauge is filling toward, e.g. "7 DAY STREAK". */
  nextLabel: string;
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
  px.r(x, y, w, 2, P.wood[3]); // lit top
  px.r(x, y, 2, h, P.wood[3]); // lit left
  px.r(x, y + h - 2, w, 2, P.wood[0]); // shaded bottom
  px.r(x + w - 2, y, 2, h, P.wood[0]); // shaded right
  px.r(x, y, 2, 2, P.wood[0]); // hard corners
  px.r(x + w - 2, y, 2, 2, P.wood[0]);
  px.r(x, y + h - 2, 2, 2, P.wood[0]);
  px.r(x + w - 2, y + h - 2, 2, 2, P.wood[0]);
}

/**
 * A carved trough with notched segments — not a rounded bar, not a percentage
 * ring. Partial fill lands inside a segment so the eye reads "most of the way
 * through the third notch" rather than a number.
 */
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

function draw(px: Px, m: HudModel): void {
  px.clear();

  // Title sign.
  panel(px, 0, 0, HUD_W, 30);
  const title = "BTC HOMESTEAD";
  px.text(title, Math.round((HUD_W - textWidth(title)) / 2), 11, P.gold[4]);

  // Status panel.
  panel(px, 8, 36, 224, 68);
  const headline = `STREAK ${m.streak} ${m.streak === 1 ? "DAY" : "DAYS"}`;
  px.text(headline, 18, 46, P.gold[4]);

  gauge(px, 18, 58, 204, m.nextProgress);
  px.text(m.nextLabel.slice(0, 33), 18, 71, P.wood[4]);

  const btc = `${(m.totalSats / 100_000_000).toFixed(8)} BTC`;
  px.text(btc, 18, 84, P.grass[4]);
  const lv = `DAYS ${m.daysRecorded}  LV ${m.stage}`;
  px.text(lv, 232 - 10 - textWidth(lv), 84, P.wood[4]);
}

/** Owns the HUD texture and redraws it only when the model actually changes. */
export class Hud {
  private readonly px = new Px(HUD_W, HUD_H);
  private last = "";
  private readonly texture: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    if (scene.textures.exists(HUD_KEY)) scene.textures.remove(HUD_KEY);
    const texture = scene.textures.addCanvas(HUD_KEY, this.px.canvas);
    if (!texture) throw new Error("could not create HUD canvas texture");
    this.texture = texture;
    this.image = scene.add
      .image(0, 0, HUD_KEY)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1_000_000);
  }

  update(m: HudModel): void {
    const key = JSON.stringify(m);
    if (key === this.last) return;
    this.last = key;
    draw(this.px, m);
    this.texture.refresh();
  }
}
