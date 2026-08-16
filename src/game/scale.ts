/**
 * Integer scaling (L3 / ASSET_SPEC §1).
 *
 * "This one line is the difference between crisp and mushy, and it is the most
 * commonly botched thing in web pixel art." — AUDIT.md §3
 *
 * The contract:
 *   - scale is an INTEGER, >= 1, never fractional
 *   - the canvas backing store is sized in whole internal pixels
 *   - CSS size is always exactly `internal * scale`
 *   - taller viewports EXTEND the world vertically; they never letterbox
 */

/** Design resolution. 9:16, = 11.25 x 20 tiles. */
export const DESIGN_W = 360;
export const DESIGN_H = 640;

export const TILE = 32;

/** MVP map: exactly one screen, no camera scroll. */
export const MAP_COLS = 11;
export const MAP_ROWS = 20;
export const MAP_W = MAP_COLS * TILE; // 352
export const MAP_H = MAP_ROWS * TILE; // 640

export type Viewport = {
  /** Integer CSS-pixels per internal pixel. */
  scale: number;
  /** Canvas backing-store width, in internal pixels. Always DESIGN_W. */
  internalW: number;
  /** Canvas backing-store height, in internal pixels. >= DESIGN_H (extend, never letterbox). */
  internalH: number;
  /** Canvas CSS width  = internalW * scale. */
  cssW: number;
  /** Canvas CSS height = internalH * scale. */
  cssH: number;
  /** Left offset to centre the canvas horizontally in the viewport. */
  offsetX: number;
  /** Extra internal rows beyond the 640-tall design, gained on tall phones. */
  extraRows: number;
};

/**
 * Resolve a browser viewport (CSS px) to an integer-scaled canvas geometry.
 *
 * `scale = max(1, floor(min(vw/360, vh/640)))` — exactly as locked in L3. The
 * height is then re-derived from the chosen scale so the canvas fills the screen
 * in whole internal pixels instead of leaving a bar.
 */
export function computeViewport(vw: number, vh: number): Viewport {
  const scale = Math.max(1, Math.floor(Math.min(vw / DESIGN_W, vh / DESIGN_H)));
  const internalW = DESIGN_W;
  const internalH = Math.max(DESIGN_H, Math.floor(vh / scale));
  const cssW = internalW * scale;
  const cssH = internalH * scale;
  return {
    scale,
    internalW,
    internalH,
    cssW,
    cssH,
    offsetX: Math.max(0, Math.floor((vw - cssW) / 2)),
    extraRows: internalH - DESIGN_H,
  };
}

/**
 * Apply a viewport to a canvas: fixed backing store, CSS transform for the scale.
 * Never `width = vw` — that is the fractional-backing-store mistake L3 forbids.
 */
export function applyViewport(canvas: HTMLCanvasElement, v: Viewport): void {
  canvas.style.width = `${v.internalW}px`;
  canvas.style.height = `${v.internalH}px`;
  canvas.style.transformOrigin = "top left";
  canvas.style.transform = `translate(${v.offsetX}px, 0px) scale(${v.scale})`;
  canvas.style.imageRendering = "pixelated";
}
