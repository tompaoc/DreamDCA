/**
 * Procedural placeholder art.
 *
 * HANDOFF.md §4.5: "build against procedural placeholders so engineering is never
 * blocked." Everything here is drawn with integer `fillRect` from the 48-colour
 * palette, so placeholders obey the two rules that matter — binary alpha and
 * palette-locked — and get replaced by real Aseprite atlases without any code
 * change beyond deleting this file's registration call.
 *
 * Frame sizes are the ones locked in ASSET_SPEC §2. Do not "improve" them here;
 * an artist delivering to a different size is 40 sprites of rework.
 */
import type Phaser from "phaser";
import { PALETTE as P } from "../core/palette";

/** A tiny integer-only pixel canvas. No AA, no gradients, no partial alpha. */
class Px {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const g = this.canvas.getContext("2d");
    if (!g) throw new Error("2d context unavailable");
    g.imageSmoothingEnabled = false;
    this.g = g;
  }

  /** Solid rect. Every argument is floored: no half-pixels, ever. */
  r(x: number, y: number, w: number, h: number, color: string): this {
    this.g.fillStyle = color;
    this.g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
    return this;
  }

  /** 1px silhouette outline in ink, per ASSET_SPEC §4.6. */
  outline(x: number, y: number, w: number, h: number, color: string = P.ink[0]): this {
    this.r(x, y, w, 1, color);
    this.r(x, y + h - 1, w, 1, color);
    this.r(x, y, 1, h, color);
    this.r(x + w - 1, y, 1, h, color);
    return this;
  }
}

/** Deterministic value noise. Same map every run — placeholders must not shimmer. */
export function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

const register = (scene: Phaser.Scene, key: string, px: Px) => {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, px.canvas);
};

/* ── characters ───────────────────────────────────────────────────────────── */

type Dir = "south" | "north" | "east";

/**
 * One 32x48 player frame. Light is top-left in every asset (ASSET_SPEC §4.7).
 *
 * The feet row is FIXED at y=47 in every frame of every direction — rule 4, the
 * one that stops the character pogoing down the path. Walk motion is expressed
 * in the legs and arms only, never by moving the body up and down.
 */
function playerFrame(dir: Dir, frame: number): Px {
  const px = new Px(32, 48);
  const ink = P.ink[0];
  const hair = "#3B2109";
  const top = P.cloth[1];
  const topLit = P.cloth[2];
  const leg = P.cloth[0];
  const skin = P.skin[2];
  const skinShade = P.skin[1];

  // Contact shadow — grounds the sprite, same row in every frame.
  px.r(8, 46, 16, 2, P.ink[1]);

  // Head.
  px.r(9, 3, 14, 13, hair);
  if (dir !== "north") {
    px.r(10, 7, 12, 9, skinShade);
    px.r(10, 7, 11, 8, skin);
    if (dir === "south") {
      px.r(13, 10, 2, 2, ink);
      px.r(18, 10, 2, 2, ink);
    } else {
      px.r(18, 10, 2, 2, ink); // profile: one visible eye
    }
  }
  px.outline(9, 2, 14, 15, ink);

  // Torso. Lit edge top-left.
  px.r(7, 17, 18, 16, top);
  px.r(7, 17, 18, 2, topLit);
  px.r(7, 17, 2, 16, topLit);
  px.r(13, 21, 6, 8, P.gold[3]); // emblem
  px.outline(7, 17, 18, 16, ink);

  // Arms swing opposite the legs on the contact frames.
  const swing = frame === 1 ? 0 : frame === 3 ? 0 : frame === 0 ? -2 : 2;
  px.r(4, 19 + swing, 3, 11, top);
  px.r(25, 19 - swing, 3, 11, top);
  px.r(4, 29 + swing, 3, 3, skinShade);
  px.r(25, 29 - swing, 3, 3, skinShade);

  // Legs. Frames 1 and 3 are the same passing pose (ASSET_SPEC §3).
  const stride = frame === 0 ? 3 : frame === 2 ? -3 : 0;
  px.r(9 - Math.min(0, stride), 33, 6, 9, leg);
  px.r(17 + Math.max(0, stride) - stride, 33, 6, 9, leg);
  // Boots. Bottom row is always 45 -> baseline never moves.
  px.r(8 - Math.min(0, stride), 42, 8, 4, P.ink[2]);
  px.r(16 + Math.max(0, stride) - stride, 42, 8, 4, P.ink[2]);
  px.r(8 - Math.min(0, stride), 45, 8, 1, ink);
  px.r(16 + Math.max(0, stride) - stride, 45, 8, 1, ink);

  return px;
}

/* ── props ────────────────────────────────────────────────────────────────── */

/** 160x176 cottage, four progression levels. The hero asset (AUDIT §11.4). */
function cottage(level: 1 | 2 | 3 | 4): Px {
  const px = new Px(160, 176);
  const scale = [0.45, 0.62, 0.82, 1][level - 1];
  const w = Math.round(70 + 88 * scale);
  const h = Math.round(52 + 108 * scale);
  const x = Math.round((160 - w) / 2);
  const y = 176 - h;

  const wallH = Math.round(h * 0.56);
  const roofH = h - wallH;

  // Roof plane, a different angle from the walls (AUDIT §9).
  for (let i = 0; i < roofH; i++) {
    const inset = Math.round((i / roofH) * (w * 0.06));
    px.r(x - 6 + inset, y + i, w + 12 - inset * 2, 1, i < 2 ? P.accent[2] : P.accent[1]);
  }
  px.r(x - 6, y + roofH - 2, w + 12, 2, P.accent[0]);
  // Hard 1px overhang shadow.
  px.r(x - 4, y + roofH, w + 8, 2, P.ink[1]);

  // Walls.
  px.r(x, y + roofH, w, wallH, P.wood[2]);
  px.r(x, y + roofH, 2, wallH, P.wood[3]); // top-left lit
  px.r(x + w - 2, y + roofH, 2, wallH, P.wood[1]);

  // Door + windows.
  const dw = 22;
  px.r(x + (w - dw) / 2, y + h - 34, dw, 34, P.wood[0]);
  px.r(x + (w - dw) / 2 + 15, y + h - 18, 3, 3, P.gold[3]);
  if (level >= 2) {
    px.r(x + 10, y + roofH + 10, 16, 14, P.gold[2]);
    px.outline(x + 10, y + roofH + 10, 16, 14, P.wood[0]);
  }
  if (level >= 3) {
    px.r(x + w - 26, y + roofH + 10, 16, 14, P.gold[2]);
    px.outline(x + w - 26, y + roofH + 10, 16, 14, P.wood[0]);
    px.r(x + w - 22, y - 16, 12, 18, P.stone[1]); // chimney
    px.r(x + w - 24, y - 19, 16, 4, P.stone[2]);
  }
  if (level >= 4) {
    px.r(x - 14, y + h - 26, 12, 26, P.wood[1]); // porch post
    px.r(x + w + 2, y + h - 26, 12, 26, P.wood[1]);
    px.r(x - 16, y + h - 30, w + 32, 5, P.wood[3]);
  }
  // One asymmetric detail — never a clean box.
  px.r(x - 9, y + h - 12, 7, 12, P.wood[0]);
  px.r(x - 10, y + h - 15, 9, 4, P.wood[3]);
  return px;
}

/**
 * The stage-0 home: a tent on a bare plot.
 *
 * Drawn on the SAME 160x176 canvas as the cottage so all five rungs of the BTC
 * ladder share one anchor and one footprint. A swappable prop set has to agree
 * on its ground contact or the world jumps when it upgrades.
 */
function tent(): Px {
  const px = new Px(160, 176);
  const baseY = 176;
  const w = 76;
  const h = 52;
  const x = (160 - w) / 2;
  const y = baseY - h;

  for (let i = 0; i < h; i++) {
    const half = Math.round((i / h) * (w / 2));
    px.r(80 - half, y + i, half * 2, 1, i < 3 ? P.cloth[2] : P.cloth[1]);
  }
  px.r(x, baseY - 3, w, 3, P.ink[1]);
  // Door flap, opened asymmetrically.
  px.r(74, y + h - 26, 12, 26, P.ink[1]);
  px.r(86, y + h - 22, 5, 22, P.cloth[0]);
  // Guy ropes and pegs.
  px.r(x - 12, baseY - 4, 12, 1, P.wood[3]);
  px.r(x + w, baseY - 4, 12, 1, P.wood[3]);
  px.r(x - 13, baseY - 5, 2, 5, P.wood[1]);
  px.r(x + w + 11, baseY - 5, 2, 5, P.wood[1]);
  // A campfire ring — the one asymmetric detail.
  px.r(28, baseY - 12, 16, 6, P.stone[1]);
  px.r(32, baseY - 16, 8, 5, P.accent[2]);
  px.r(34, baseY - 19, 4, 4, P.gold[3]);
  return px;
}

function lantern(): Px {
  const px = new Px(32, 32);
  px.r(14, 8, 4, 24, P.wood[1]);
  px.r(10, 4, 12, 4, P.wood[2]);
  px.r(11, 8, 10, 12, P.ink[1]);
  px.r(13, 10, 6, 8, P.gold[4]);
  px.r(14, 12, 4, 5, P.gold[3]);
  px.r(9, 28, 14, 4, P.ink[1]);
  return px;
}

function chicken(frame: number): Px {
  const px = new Px(16, 16);
  const bob = frame === 1 ? 1 : 0;
  px.r(4, 14, 8, 2, P.ink[1]); // shadow, fixed row
  px.r(4, 6 + bob, 8, 7, P.bloom[2]);
  px.r(4, 6 + bob, 8, 2, "#FFFFFF".replace("#FFFFFF", P.bloom[2]));
  px.r(9, 3 + bob, 4, 4, P.bloom[2]);
  px.r(11, 4 + bob, 1, 1, P.ink[0]);
  px.r(13, 5 + bob, 2, 1, P.gold[2]); // beak
  px.r(9, 1 + bob, 3, 2, P.accent[1]); // comb
  px.r(5, 13, 2, 2, P.gold[2]);
  px.r(9, 13, 2, 2, P.gold[2]);
  return px;
}

function dog(frame: number): Px {
  const px = new Px(24, 20);
  const tail = frame === 1 ? 1 : 0;
  px.r(4, 18, 15, 2, P.ink[1]); // shadow, fixed row
  px.r(5, 8, 13, 7, P.wood[3]);
  px.r(5, 8, 13, 2, P.wood[4]);
  px.r(15, 4, 6, 6, P.wood[3]); // head
  px.r(19, 6, 1, 1, P.ink[0]);
  px.r(15, 2, 2, 3, P.wood[1]); // ear
  px.r(20, 8, 2, 1, P.ink[0]); // snout
  px.r(3 - tail, 5 + tail, 3, 5, P.wood[2]); // tail wags
  px.r(6, 15, 3, 3, P.wood[1]);
  px.r(14, 15, 3, 3, P.wood[1]);
  return px;
}

function vault(): Px {
  const px = new Px(64, 64);
  px.r(4, 12, 56, 52, P.stone[1]);
  px.r(4, 12, 56, 3, P.stone[3]);
  px.r(4, 12, 3, 52, P.stone[2]);
  px.r(0, 6, 64, 8, P.stone[2]);
  px.r(0, 6, 64, 2, P.stone[3]);
  px.r(20, 28, 24, 24, P.gold[1]);
  px.r(20, 28, 24, 2, P.gold[3]);
  px.r(28, 36, 8, 8, P.gold[3]);
  px.r(31, 38, 2, 8, P.gold[0]);
  px.outline(4, 12, 56, 52, P.ink[0]);
  return px;
}

/** Trunk and canopy are SEPARATE sprites, for depth sorting (ASSET_SPEC §2). */
function treeTrunk(): Px {
  const px = new Px(32, 32);
  px.r(12, 6, 9, 26, P.wood[1]);
  px.r(12, 6, 2, 26, P.wood[2]);
  px.r(19, 6, 2, 26, P.wood[0]);
  px.r(8, 28, 17, 4, P.ink[1]); // root shadow
  return px;
}

function treeCanopy(): Px {
  const px = new Px(96, 80);
  const cx = 48;
  const cy = 40;
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 96; x++) {
      const dx = (x - cx) / 46;
      const dy = (y - cy) / 36;
      const d = dx * dx + dy * dy;
      const wobble = hash(x >> 2, y >> 2) * 0.22;
      if (d + wobble > 1) continue;
      // Light top-left: three foliage bands.
      const lit = (x - cx) * 0.5 + (y - cy) * 0.8;
      const c = lit < -18 ? P.foliage[3] : lit < 8 ? P.foliage[2] : P.foliage[1];
      px.r(x, y, 1, 1, c);
    }
  }
  return px;
}

function fence(): Px {
  const px = new Px(32, 32);
  const lean = 0; // straight segment; leaning variants come with real art
  px.r(3 + lean, 12, 4, 20, P.wood[1]);
  px.r(25 + lean, 12, 4, 20, P.wood[1]);
  px.r(0, 16, 32, 3, P.wood[3]);
  px.r(0, 24, 32, 3, P.wood[2]);
  return px;
}

function sign(): Px {
  const px = new Px(32, 32);
  px.r(14, 14, 4, 18, P.wood[0]);
  px.r(4, 6, 24, 13, P.wood[3]);
  px.r(4, 6, 24, 2, P.wood[4]);
  px.r(7, 11, 18, 2, P.wood[0]);
  px.outline(4, 6, 24, 13, P.ink[0]);
  return px;
}

/* ── terrain ──────────────────────────────────────────────────────────────── */

const TERRAIN_KEY = "terrain_baked";

/**
 * Bake the whole terrain layer into one texture.
 *
 * L7: terrain is static for the life of the save, so it is drawn once and never
 * sorts. Everything that responds to progression is a prop sprite, not a tile.
 */
export function bakeTerrain(scene: Phaser.Scene, w: number, h: number): string {
  const px = new Px(w, h);

  // Grass base with deterministic tuft noise.
  px.r(0, 0, w, h, P.grass[1]);
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = hash(x, y);
      if (n > 0.86) px.r(x, y, 2, 1, P.grass[2]);
      else if (n < 0.1) px.r(x, y, 2, 1, P.grass[0]);
      else if (n > 0.80) px.r(x, y, 1, 1, P.grass[3]);
    }
  }

  // Dirt path spine, with eroded edges — no straight seams on organic material.
  for (let y = 0; y < h; y++) {
    const centre = 180 + Math.round(Math.sin(y / 46) * 22);
    const half = 20 + Math.round(hash(y, 7) * 5);
    px.r(centre - half, y, half * 2, 1, P.dirt[2]);
    px.r(centre - half, y, 2 + Math.round(hash(y, 3) * 3), 1, P.dirt[3]);
    px.r(centre + half - 2, y, 2, 1, P.dirt[1]);
    if (hash(y, 11) > 0.9) px.r(centre - half + 6, y, 3, 1, P.dirt[4]);
  }

  // Pond, bottom-left. Irregular edge, hard shoreline.
  // Fixed to the 360x640 design box, not to `h` — props are laid out in design
  // space, and terrain features must not slide relative to them on tall phones.
  const pcx = 62;
  const pcy = 470;
  for (let y = pcy - 54; y < pcy + 54; y++) {
    for (let x = 0; x < 130; x++) {
      const dx = (x - pcx) / 58;
      const dy = (y - pcy) / 42;
      const d = dx * dx + dy * dy + hash(x >> 2, y >> 2) * 0.24;
      if (d > 1) continue;
      px.r(x, y, 1, 1, d > 0.82 ? P.water[2] : d > 0.5 ? P.water[1] : P.water[0]);
    }
  }

  return (register(scene, TERRAIN_KEY, px), TERRAIN_KEY);
}

/* ── registration ─────────────────────────────────────────────────────────── */

export const PLAYER_DIRS: Dir[] = ["south", "north", "east"];

/** Build and register every placeholder texture this scene needs. */
export function buildPlaceholderTextures(scene: Phaser.Scene): void {
  for (const dir of PLAYER_DIRS) {
    for (let f = 0; f < 4; f++) {
      register(scene, `char_player_walk_${dir}_${f}`, playerFrame(dir, f));
    }
    register(scene, `char_player_idle_${dir}_0`, playerFrame(dir, 1));
  }
  for (const lv of [1, 2, 3, 4] as const) {
    register(scene, `prop_cottage_lv${lv}`, cottage(lv));
  }
  register(scene, "prop_tent", tent());
  register(scene, "prop_vault", vault());
  register(scene, "prop_lantern", lantern());
  register(scene, "prop_tree_trunk", treeTrunk());
  register(scene, "prop_tree_canopy", treeCanopy());
  register(scene, "prop_fence", fence());
  register(scene, "prop_sign", sign());
  for (let f = 0; f < 2; f++) {
    register(scene, `anim_chicken_idle_south_${f}`, chicken(f));
    register(scene, `anim_dog_idle_south_${f}`, dog(f));
  }
}
