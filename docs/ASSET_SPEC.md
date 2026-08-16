# Dream DCA — Technical Art Specification v1.0

**Status: DRAFT — lock this before commissioning or generating any further art.**

This is the document that must be signed off before Phase 1. Any asset that violates it gets
rejected by CI, not by a code review conversation.

---

## 1. Grid & resolution

| Spec | Value | Notes |
|---|---|---|
| Tile size | **32 × 32 px** | Power of two. Non-negotiable. |
| Internal render resolution | **360 × 640 px** | 9:16, = 11.25 × 20 tiles |
| Scaling | **Integer only**, nearest-neighbour | `scale = max(1, floor(min(vw/360, vh/640)))` |
| Vertical behaviour | **Extend**, not letterbox | Taller phones see more world, never black bars |
| MVP map size | **11 × 20 tiles** (352 × 640) | One screen. No camera scroll in MVP. |

**Canvas setup (mandatory):**
```css
canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
```
Canvas backing store is fixed at 360×640. Scale via CSS `transform: scale(n)` with integer `n`.
Never resize the backing store to a fractional multiple. Never use `Phaser.Scale.FIT` alone —
it produces fractional scales.

---

## 2. Sprite frame sizes

| Class | Frame | Anchor | Notes |
|---|---|---|---|
| Player | **32 × 48** | bottom-centre (16, 47) | 1.5 tiles tall |
| NPC (humanoid) | **32 × 48** | bottom-centre | Identical rig to player |
| Chicken | **16 × 16** | bottom-centre (8, 15) | |
| Dog | **24 × 20** | bottom-centre (12, 19) | |
| Cow (post-MVP) | **40 × 32** | bottom-centre (20, 31) | |
| Cottage | **160 × 176** | bottom-centre | 5 tiles wide |
| Vault | **64 × 64** | bottom-centre | |
| Chicken coop | **96 × 96** | bottom-centre | |
| Tree — trunk | **32 × 32** | bottom-centre | **Separate sprite from canopy** |
| Tree — canopy | **96 × 80** | bottom-centre, offset above trunk | Sorts above player |
| Rock / bush | **32 × 32** | bottom-centre | |
| Fence segment | **32 × 32** | bottom-centre | |
| Chest | **32 × 32** | bottom-centre | |
| Sign | **32 × 32** | bottom-centre | |

**The anchor is the ground-contact point.** It is what depth sorting and collision positioning
both use. It is not the sprite centre and it is not the bounding-box bottom — it is where the
object touches the ground, which for a leaning sign may be inset from the sprite edge.

---

## 3. Animation standards

| Animation | Frames | FPS | Loop |
|---|---|---|---|
| Player idle | 1 per direction | — | static |
| Player walk | 4 per direction | 8 | loop |
| Chicken idle | 2 | 3 | loop |
| Chicken peck | 3 | 6 | once, then idle |
| Chicken walk | 4 | 8 | loop |
| Dog idle (tail wag) | 3 | 4 | loop, ping-pong |
| Dog walk | 4 | 8 | loop |
| Water — still/pond | 3 | 4 | loop |
| Water — river flow | 4 | 8 | loop |
| Water — shore foam | 3 | 4 | loop |
| Chimney smoke | 4 | 5 | loop |
| Canopy sway | 3 | 2 | loop, ping-pong |
| Chest sparkle | 4 | 8 | loop |

**Directions:** exactly four — `south` (front), `north` (back), `east`, `west`.
`west` is a **horizontal mirror of `east`**. Do not draw it twice; do not let an artist deliver an
asymmetric `west`. This halves the character art budget and guarantees consistency.

**Walk cycle frame order:** `[contact_L, passing, contact_R, passing]` — frames 1 and 3 are the
same passing pose. So a 4-frame walk is **3 unique drawings**, not 4.

---

## 4. Hard technical rules

These are enforced by CI. A build fails if any is violated.

1. **Alpha is binary.** Every pixel is `alpha == 0` or `alpha == 255`. No values in between, ever.
   *(All seven current AI-generated sheets fail this — max alpha is 254 and 33–65% of pixels are
   partial.)*
2. **Palette-locked.** Every non-transparent pixel must be one of the 48 colours in
   `art/dreamdca-48.gpl`. Work in Aseprite **Indexed** colour mode.
3. **No anti-aliasing, no blur, no gradients, no soft shadows.** Shading is by pixel cluster and
   palette ramp only.
4. **Baseline is pixel-identical across every frame of an animation.** The ground-contact row
   must not move by even 1 px between frames unless the animation is deliberately a jump.
5. **Every frame is exactly the declared frame size**, padded with transparency. No trimming, no
   variable-size frames, no bleed past the cell.
6. **1 px outline** in an `ink` ramp colour on all character and prop silhouettes. Interior lines
   may use a darker shade of the local ramp instead of pure ink.
7. **Light direction is top-left**, in every asset, in every world, permanently.
8. Source files are `.aseprite`. Exports are build output and are never hand-edited.

### CI validator

```python
# scripts/validate_art.py — run in CI over art/**/*.png
from PIL import Image
import numpy as np, sys, glob

PALETTE = {tuple(int(l.split()[i]) for i in range(3))
           for l in open('art/dreamdca-48.gpl').read().splitlines()[4:] if l.strip()}

fail = False
for f in glob.glob('art/**/*.png', recursive=True):
    a = np.array(Image.open(f).convert('RGBA'))
    alpha = a[..., 3]
    bad_alpha = ((alpha > 0) & (alpha < 255)).sum()
    if bad_alpha:
        print(f'FAIL {f}: {bad_alpha} partial-alpha pixels'); fail = True
    cols = {tuple(c) for c in np.unique(a[..., :3][alpha == 255].reshape(-1, 3), axis=0)}
    off = cols - PALETTE
    if off:
        print(f'FAIL {f}: {len(off)} off-palette colours, e.g. {list(off)[:3]}'); fail = True
sys.exit(1 if fail else 0)
```

---

## 5. Master palette — 48 colours

Locked. Delivered as `art/dreamdca-48.gpl` (Aseprite/GIMP) and `art/palette.png` (visual sheet).

| Ramp | Colours |
|---|---|
| `ink` (3) | `#140F14` `#241A21` `#3A2B33` |
| `grass` (5) | `#2E5227` `#3F6E2E` `#57913A` `#77B24A` `#9CCB63` |
| `foliage` (4) | `#16351F` `#20502C` `#2F6E38` `#478C42` |
| `dirt` (5) | `#3A2410` `#573418` `#7A4C22` `#9C6A34` `#C08F51` |
| `stone` (4) | `#2C2A2E` `#474550` `#6A6672` `#9A96A0` |
| `wood` (5) | `#3B2109` `#5B3311` `#7E4A1B` `#A3682B` `#C68F45` |
| `water` (5) | `#0E2E52` `#17497F` `#2470B4` `#3E9BD8` `#8CD3EE` |
| `gold` (5) | `#5C3405` `#96600C` `#D2951A` `#F5C13C` `#FFE79A` |
| `skin` (3) | `#6B3B2A` `#B36A45` `#E8B283` |
| `accent` (3) | `#701B2E` `#C4383F` `#EE8A55` |
| `cloth` (3) | `#181A24` `#2F374F` `#5C6B94` |
| `bloom` (3) | `#B23F9C` `#EE9AD6` `#FFF4C2` |

**Per-world weighting** (same 48 colours, different emphasis — this is what makes eight worlds
look like one game):

| World | Dominant ramps | Accent |
|---|---|---|
| BTC Homestead | grass, foliage, wood | gold |
| ONDO Business City | stone, cloth, dirt | gold |
| BIO Research Lab | stone, water, foliage | bloom |
| SOL Technology City | cloth, stone, water | bloom |
| LINK Network World | stone, water, ink | water-light |
| AAVE Lending Castle | stone, wood, ink | accent |
| PENDLE Harvest World | dirt, grass, gold | accent |
| CC Financial Network | cloth, stone, gold | water-light |

---

## 6. Naming convention

```
tile_<material>_<variant>.png            tile_grass_blob_23.png
prop_<name>[_<state>].png                prop_cottage_lv3.png
char_<who>_<action>_<dir>_<frame>.png    char_player_walk_south_2.png
anim_<who>_<action>_<dir>_<frame>.png    anim_chicken_peck_east_1.png
fx_<name>_<frame>.png                    fx_smoke_2.png
ui_<element>[_<state>].png               ui_panel_9slice.png
```

- lowercase, underscores only, no spaces, no capitals, no hyphens
- frame indices are **0-based**
- directions are exactly `north` `south` `east` `west`
- `west` variants are generated by mirroring at build time and must not exist as source files

---

## 7. UI / HUD specification

**Font:** one bitmap font, pixel-aligned, no system font anywhere on the game screen.
Recommend a 6×8 or 8×8 bitmap face rendered at integer scale only.
*If a single glyph of Inter, Roboto or SF Pro appears on the world screen, the illusion is dead.*

> ### ⚠ Thai text and bitmap fonts — a real constraint, decide it early
>
> Thai needs stacked vowels and tone marks above **and** below the base glyph. A 5×7 or 6×8
> bitmap cell physically cannot hold ก + ่ + ิ legibly. Building this out is a genuine project:
> roughly a 13–16 px tall face with dedicated above/below mark rows, plus mark-positioning logic.
> That is weeks of work, not an afternoon.
>
> **Recommended split, proven in the Phase 1 slice:**
>
> | Layer | Font | Content |
> |---|---|---|
> | Canvas HUD | 5×7 bitmap, **ASCII/uppercase only** | `STREAK 13 DAYS`, `0.0391 BTC`, `HOUSE LV 3`, milestone banners |
> | HTML overlay | real webfont | all Thai — dialogue, forms, calendar, settings, onboarding |
>
> Numbers and short status labels stay in-world and pixel-perfect; anything the user has to
> *read* is Thai in the HTML layer, styled with the same wooden 9-slice chrome so the fiction
> holds. This is another thing that is nearly free on web and painful in a game engine.
>
> If Thai must appear inside the canvas later, budget a custom 16 px face — and lock that
> decision before the HUD is built, because it changes every panel height in §7.

**Panels:** 9-slice, 4 px border, hard pixel corners.
- `border-radius: 0` — always
- `box-shadow: none` — always
- no `rgba()` translucency, no blur, no gradients
- panel fill is a `wood` or parchment ramp, never grey UI chrome

**Buttons:** 2 px bevel — light ramp on top+left, dark ramp on bottom+right. Inverted on press,
with the label shifted down-right by 1 px.

**Progress gauge:** a carved wooden trough with **notched segments** (e.g. 4 segments = 25% each,
partial fill within a segment). Not a rounded bar, not a percentage ring.

**Layout zones (360 × 640 internal):**

| Zone | Rect | Contents |
|---|---|---|
| Title bar | `0,0 – 360,32` | World name + trophy + settings, on a wooden sign |
| Status panel | `8,36 – 232,104` | BTC / goal, progress gauge, house level |
| World viewport | full screen, behind UI | The map |
| Action bar | `0,584 – 360,640` | My Worlds · Record · Calendar |
| Safe area | 16 px inset all sides | Respect `env(safe-area-inset-*)` |

**Touch targets:** minimum **44 × 44 CSS px** (≈15 internal px at 3× scale). Pixel art aesthetics
do not exempt you from thumb ergonomics.

**Data screens** (calendar, purchase entry) are permitted to be more conventional and legible.
Frame them as an in-world journal/ledger book — you keep the fiction without fighting usability.

---

## 8. Map & prop data formats

**Terrain** — authored in Tiled, exported as `.tmj` (JSON). One tile layer + a boolean `collide`
tile property. Blob autotiling (47-tile) for grass↔dirt, dirt↔stone, land↔water.

**Props** — Tiled object layer, exported to `props.json`:

```json
{
  "id": "cottage",
  "sprite": "prop_cottage_lv3",
  "x": 176, "y": 288,
  "anchorY": 136,
  "footprint": { "x": 8, "y": 96, "w": 144, "h": 40 },
  "unlock": null,
  "interact": "enter_house",
  "worldStage": 0
}
```

- `x, y` — top-left in internal pixels (not tiles; props are free-positioned)
- `anchorY` — ground-contact row, relative to sprite top. Drives depth sort.
- `footprint` — collision rect, relative to sprite top-left. **Never derived from the sprite.**
- `unlock` — milestone id, or `null` for always-present
- `worldStage` — minimum stage at which this prop appears

**Depth sort:** `sprite.depth = Math.round(sprite.y + anchorY)` on a single shared container.
Terrain renders below at fixed depth.

---

## 9. Sign-off checklist

Nothing gets commissioned until every box is ticked.

- [ ] Tile size **32** confirmed on a real phone via `dreamdca-testbench.html`
- [ ] Internal resolution **360 × 640** confirmed on a real phone
- [ ] Character frame **32 × 48** confirmed against the cottage at 160 px wide
- [ ] Palette locked; `dreamdca-48.gpl` loaded in Aseprite by everyone touching art
- [ ] `validate_art.py` wired into CI and failing on a deliberately bad test PNG
- [ ] Naming convention agreed
- [ ] Aseprite CLI export script committed and runnable via `npm run assets`
- [ ] Bitmap font chosen and licensed
- [ ] Engine decision made (see AUDIT.md §2)
- [ ] Walkable-vs-diorama decision made (see AUDIT.md §12)
