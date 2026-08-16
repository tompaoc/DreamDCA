# Dream DCA / BTC Homestead — Technical Production Audit

Reviewed as incoming technical director. Written to be actionable, not diplomatic.

---

## 0. The headline

The **product thinking is good**. "The world is the product, the finance data supports the fantasy"
is the right principle, and decoupling world condition from market price is the single smartest
decision in the brief — it makes the game emotionally safe and removes a price-feed dependency
from the MVP entirely.

The **art pipeline is currently broken**, and it is broken in a way that is easy to miss because
the concept images look great. Section 1 is the part you most need to read.

Everything else is a series of decisions I can make for you now.

---

## 1. Asset triage — measured, not guessed  *(answers Q6)*

I ran the seven attached PNGs through a pixel analysis. Results:

| Sheet (by content) | Size | Unique colours | Partial-alpha px | Native pixel grid |
|---|---|---|---|---|
| Key art scene | 941×1672 | **650,135** | n/a (no alpha) | none |
| Player | 1536×1024 | **323,890** | 64.5% | none |
| Foliage | 1536×1024 | **241,040** | 62.2% | none |
| Cow | 1536×1024 | 108,369 | 34.8% | none |
| Water | 1536×1024 | 91,489 | 40.5% | none |
| Dog | 1536×1024 | 79,325 | 33.1% | none |
| Chicken | 1536×1024 | 62,593 | 32.6% | none |

### What these numbers mean

**They are not pixel art.** They are smooth digital paintings of pixel art. I tested every block
size from 2 to 12 px looking for the flat plateau that upscaled pixel art always produces — there
is none. Variance rises monotonically from n=2, which means essentially every one of the 1.5M
pixels is a slightly different colour. There is no native resolution to recover.

**The alpha channel is unusable.** Maximum alpha across every sheet is **254, not 255** — there is
not one fully opaque pixel in any of them. 33–65% of pixels sit at partial alpha. That is a
background-removal halo, and in an engine it renders as a grey fringe around every sprite.

**Naive downscaling does not rescue them.** I resampled one player frame to 32×48. The result has
**901 unique colours in 1,536 pixels**. See `art/evidence_downscale.png` — it is mush.

**Frames are not on a grid.** The player sheet is 1536 wide with 5 columns = 307.2 px per cell.
Sprites bleed to and past cell edges. Measured per-row baseline drift:

- Player row 1 (back-facing): baseline drifts **48 px** across the 5 frames
- Player row 3: **17 px** drift, and frame heights vary by 17 px
- Water sheet row 2: **45 px** baseline drift, heights vary by 58 px

At a target sprite height of 48 px that 48 px drift is roughly **9 target pixels of vertical bob**
per frame. The character would pogo down the path.

### Verdict

| Asset | Call |
|---|---|
| Key art scene | **Keep forever as the visual bible.** Never ship it. Pin it above the desk. |
| Player | **Redraw.** Silhouette + palette + outfit are good; the pixels are not. |
| Chicken / Dog / Cow | **Redraw.** Cheap — these are 16×16 to 32×24 sprites, hours not days. |
| Water | **Redraw.** Water must tile seamlessly; nothing AI-generated will. |
| Foliage | **Redraw.** Same reason, plus canopies need a separate trunk/canopy split for depth sorting. |

This is not a criticism of the concepting — it did its job. Concept art and production art are
different artefacts, and the mistake would be trying to bridge that gap with cleanup scripts. A
competent pixel artist redrawing *from* these references at native resolution is faster, cheaper,
and produces something that actually animates. Budget roughly **5–8 days** of a pixel artist for
the full MVP asset list in `ASSET_SPEC.md`.

> **Do not spend another dollar on AI-generated sprite sheets.** The failure is structural: image
> models paint what pixel art looks like, they don't place pixels on a grid from a fixed palette.
> Use them for concepting only.

---

## 2. Engine  *(answers Q1)*

### Recommendation: **not Godot. React + Vite + Phaser 3.**

The brief frames this as a mobile-first *web app* with a game view. That framing decides it.

**Against Godot for this product:**

- A Godot 4 web build ships a WASM runtime measured in tens of MB before your assets. For a
  cozy farm that is 95% overhead — you are paying a 3D-capable physics engine's download cost to
  move a chicken sprite. On a phone on mobile data, that is a cold-start you will lose users to.
- Threaded builds require COOP/COEP headers to be configured exactly right or you silently fall
  back; iOS Safari remains the weak platform and is explicitly called out as "test separately"
  in current guidance.
- **The real killer is the other 70% of your app.** Purchase entry, a 730-day calendar, text
  input, number keyboards, date pickers, auth, export/import, settings. Godot's UI toolkit is
  built for game menus, not data-entry forms. You would either rebuild all of it badly in Godot
  Control nodes, or overlay DOM on a canvas and fight coordinate systems forever. Native mobile
  text input in Godot web is genuinely painful.
- Audio decode leaks and memory-growth ceilings are known web-export pain points.

**For Phaser 3 + React:**

- Phaser core is ~1 MB. Total app ships in a couple hundred KB of JS plus your art.
- Built-in tilemap support with **direct Tiled JSON import**, texture atlases, sprite animation
  state machines, arcade physics, and `Phaser.Scale.FIT` with integer-scale snapping.
- Your calendar, purchase form and settings are just React. Native inputs, native keyboard,
  native scrolling, accessible, and free.
- One codebase → Capacitor gives you App Store / Play builds later with no rewrite.
- If you ever want native performance, you port a rendering layer, not the whole product.

**PixiJS** is the alternative if you want more control and less framework — but you'd hand-roll
the tilemap and animation systems Phaser gives you free. Not worth it here.

**When Godot *would* be right:** if you abandoned the web and shipped native-only. Given the goal
is a mobile-first web game, it isn't.

### Concrete stack

```
Vite + React 18 + TypeScript
Phaser 3            world rendering (mounted only on the World screen)
Zustand             single store; the bridge between app state and the game scene
Dexie (IndexedDB)   ledger persistence, with JSON export/import
Tiled               map authoring -> exported JSON
Aseprite            all sprite authoring -> exported PNG atlas + JSON
Capacitor           later, if you want app stores
```

Phaser is mounted/unmounted with the World screen and reads a snapshot of world state from the
store. It never owns financial data.

---

## 3. Pixel grid  *(answers Q2, Q3, Q14, Q15)*

### Lock these now

| Spec | Value |
|---|---|
| **Tile size** | **32 × 32** |
| **Internal render resolution** | **360 × 640** (11.25 × 20 tiles) |
| **Character frame** | **32 × 48** |
| **Scaling** | Integer only, nearest-neighbour |

**Why 32 and not 48:** 48 px tiles at a 360-wide viewport give you 7.5 tiles across. A farm needs
to read as a *place*; at 7.5 tiles you're looking at a doormat. 32 px gives ~11 tiles across — the
cottage lands at 5×5 tiles (160×160 px), which matches the proportion it occupies in your key art
almost exactly. 32 is also a power of two: clean atlases, clean mipmaps, clean maths, and every
tool defaults to it.

**Why not 16 (Stardew's size):** your established art direction is materially denser than Stardew —
detailed canopies, pixel-cluster shading, organic shorelines. 16 px cannot hold it. 32 can.

**Why 32×48 characters and not 48×64:** the character should be about 1.5 tiles tall. At 32 tiles
that is 48 px. A 64 px character on a 32 px tile grid looks like a giant and eats the screen on
portrait. Keep a 32×48 frame with the feet anchored to a fixed baseline.

**Why 360×640:** it is exactly 9:16, it is your own suggestion, and it scales cleanly. On a typical
390×844 CSS-px phone at DPR 3 (1170×2532 device px), 360×640 renders at **3× = 1080×1920 device px** —
fits the width with room, and you extend vertically rather than letterbox so taller phones simply
see more world. No fractional scaling anywhere.

**The scaling rule that matters:** compute `scale = Math.max(1, Math.floor(min(vw/360, vh/640)))`,
apply it as a CSS transform on a fixed-size canvas, and set `image-rendering: pixelated`. Never let
the browser resize the canvas backing store to a non-integer multiple. This one line is the
difference between crisp and mushy, and it is the most commonly botched thing in web pixel art.

I have built you a test bench (`dreamdca-testbench.html`) that renders 32 vs 48 tiles at 360×640 vs
540×960 on a real device so you can settle this by looking rather than arguing. **Open it on your
actual phone before locking.**

---

## 4. Map construction  *(answers Q4, Q13)*

### Recommendation: **hybrid — Tiled tilemap for terrain, data-driven object layer for everything else.**

Not pure tilemap, not pure scene objects. Specifically three layers with different authoring
models:

**Layer A — Terrain (true TileMap, authored in Tiled)**
Grass, dirt, stone path, crop soil, water, shorelines, cliffs. 32×32 tiles with 47-tile blob
autotiling for grass→dirt, dirt→stone and land→water transitions. This layer is **static for the
entire life of the save** — it never changes with progression. That is what makes it cheap.

**Layer B — Props (data-driven object instances, NOT tiles)**
Cottage, vault, coop, bridge, fences, trees, rocks, signs, chests, decorations. Each is a sprite
placed from a JSON manifest:

```json
{ "id": "cottage",
  "sprite": "cottage_lv3",
  "x": 176, "y": 288,
  "footprint": { "x": 8, "y": 96, "w": 144, "h": 40 },
  "anchorY": 136,
  "unlock": null,
  "interact": "enter_house" }
```

This is the layer that responds to progression. Unlocking a milestone means flipping a prop's
visibility or swapping its sprite key — **never regenerating art, never reloading the scene.**
Props are authored *positionally* in Tiled's object layer, then exported to this manifest.

**Layer C — Entities (runtime, spawned in code)**
Player, NPCs, chickens, dog, cow, FX emitters. Pure code, no authoring.

### Why the hybrid and not one big background image

Your world has to change. House level 3 → 4, dog arrives at 0.03 BTC, crop area unlocks at 0.05.
With a baked background you need one image per *combination* of states, which is combinatorial and
dead on arrival. With the hybrid, the terrain is baked once (cheap, beautiful, hand-placed) and
everything mutable is a sprite you toggle.

You already reached this conclusion in §6 and §13 of the handoff. It's correct. The only refinement
I'd add: **do not force props into the tile grid.** Trees and cottages should be free-positioned
sprites with their own footprints. Forcing a 144-px-wide cottage into 32-px tile cells is what
makes worlds look like they're built out of Lego, and it is one of the main ways pixel art starts
reading as "rectangles."

---

## 5. Collision & depth sorting  *(answers Q9)*

Two rules. Get these right and the world feels solid; get them wrong and nothing else saves it.

**Collision is decoupled from art.** Never derive a collision body from a sprite's bounding box. A
tree's collider is a ~24×16 box at the base of its trunk, not the canopy. A cottage's collider is a
thin band along its front wall. Store the footprint rect explicitly per prop (see the manifest
above) and add a boolean `collide` property on terrain tiles for water and cliffs. Arcade Physics
static bodies, one per prop footprint.

**Depth is Y-sorted on a single container.** All props and all entities live in one Phaser
container. Each frame (or on move), set `sprite.depth = Math.round(sprite.anchorY)` where `anchorY`
is the *ground contact point*, not the sprite's top or centre. The player walking behind a tree
then in front of it just works, with no special cases.

**Tall objects:** for a tree the player can walk behind, the anchor is the base of the trunk. That
single rule handles cottages, fences, signs and the coop identically. If you ever need the player
to walk *through* an arch, split the sprite into a below-anchor and above-anchor piece — but avoid
needing that in the MVP.

**Terrain never sorts.** It renders once, below everything, at a fixed depth.

---

## 6. Linking BTC data to the world  *(answers Q5)*

This is the architecture question with the highest long-term cost of getting wrong, and the answer
is unusually clean:

### The ledger is the only source of truth. Everything else is a pure function of it.

```
ledger (append-only)
   ↓  pure
derived   { totalSats, totalFiatCents, avgCostBasis, daysRecorded, streak }
   ↓  pure
unlocks   Set<milestoneId>            ← from a declarative JSON milestone table
   ↓  pure
worldState { houseLevel, visibleProps[], activeEntities[], stage }
   ↓
Phaser scene reconciles to worldState
```

**Store integers, never floats.** BTC as **satoshis (integer)**. Fiat as **cents (integer)**.
`0.1 + 0.2 !== 0.3` will silently corrupt someone's two-year savings record, and they will never
trust the app again. This is non-negotiable.

```ts
type Entry = {
  id: string;
  date: string;        // "2026-08-14", local calendar day, no time, no timezone
  sats: number;        // integer
  fiatCents: number;   // integer, in the user's chosen currency
  note?: string;
};
// priceAtBuy is DERIVED: fiatCents / (sats / 1e8) — never stored, never drifts
```

**Why purity matters more than it sounds:** the brief requires backfilling historical purchases.
With mutable world state, backfilling a January purchase in August means replaying or patching
months of milestone side-effects — a bug farm. With a pure pipeline, you insert the entry, recompute,
and the world is simply correct. Backfill becomes free.

**Milestone notifications from a diff, not from an event.** Keep `lastSeenUnlocks` in the save.
After any recompute, `newlyUnlocked = unlocks − lastSeenUnlocks`. If the user backfills six months
at once, batch the result into a single "Your homestead grew while you were away" summary instead
of firing twenty popups. Then persist `lastSeenUnlocks`.

**Milestones are data, not code:**

```json
[ { "id": "first_light",  "requires": { "sats": 1000000 },      "grants": ["prop.lantern"] },
  { "id": "good_boy",     "requires": { "sats": 3000000 },      "grants": ["entity.dog"] },
  { "id": "crop_plot",    "requires": { "sats": 5000000 },      "grants": ["prop.crops_a", "prop.scarecrow"] },
  { "id": "cottage_lv4",  "requires": { "sats": 10000000 },     "grants": ["prop.cottage:lv4"] },
  { "id": "steady_hand",  "requires": { "daysRecorded": 100 },  "grants": ["prop.bench", "npc.neighbour"] } ]
```

Note `steady_hand` keys off *consistency*, not amount. Have several like it. It is what stops the
game from being a wealth leaderboard and keeps it a habit tracker — which is what the design
principle in §18 of your handoff is actually asking for.

**No price API in the MVP.** The user enters the price they paid. Since the world deliberately
does not react to market price, you need zero external data, zero API keys, zero rate limits, and
zero "why is my farm on fire" support tickets. Add a live-price display later as pure decoration
if you want it.

### One thing the brief has not confronted

Your stated targets are internally inconsistent. 0.2 BTC over 2026–2027 (730 days) at ~$9/day is
$6,570 total — which only reaches 0.2 BTC if BTC averages around $33k. At any plausible price it
gets you closer to 0.05–0.07 BTC. **The progress bar will sit under 35% for two straight years.**

That is a game design problem, not a maths problem, and it has a good fix: **don't make the
headline progress bar the BTC goal.** Make the primary loop *days recorded* and *streak* — things
the user fully controls and can complete — and treat BTC accumulation as the long horizon shown
separately. Ties directly into your "never shame the user" principle. Worth deciding before you
build the HUD, because it changes what the HUD says.

---

## 7. Vertical slice  *(answers Q7)*

Your §10 MVP list is close but still about 3× too big. Cuts, in order of how much they save:

| Cut | Why |
|---|---|
| **Camera follow / scrolling map** | Make the MVP map **exactly one screen**, 11×20 tiles. Kills camera code, culling, minimap, and ~60% of the terrain art. The homestead being fully visible at once is *better* for a cozy game anyway. Add scrolling when you add world #2. |
| **Cow** | Largest, most animation-frames, least charm per pixel. Ship chicken + dog. |
| **NPC dialogue** | Ship *one* NPC who idles and waves. No dialogue tree, no routine, no relationship state. |
| **Save/load UI** | Autosave to IndexedDB. Export/import JSON button. No slots, no cloud. |
| **Audio** | Entirely. It's a whole discipline and it's not what you're validating. |
| **All non-BTC worlds** | You already said this. Hold the line. |

### The slice, definitively

1. One 11×20-tile BTC Homestead, one screen, no scroll
2. Player: 4-direction walk (4 frames) + idle (1 frame), 32×48
3. Collision + Y-sorted depth
4. Animated water (3 frames) and chimney smoke — the two cheapest "this world is alive" signals
5. Two chickens (peck/idle/walk), one dog (idle/walk/tail)
6. One idle NPC
7. Purchase entry: date, fiat amount, BTC price → computed sats
8. Calendar: month view, 2026–2027, backfill-capable, dots on recorded days
9. Derived stats: total BTC, total invested, weighted average cost
10. HUD: diegetic RPG panel, not a card
11. 5 milestones from a JSON table, with a batched unlock notification
12. Autosave + JSON export/import

**Success criterion:** you record a purchase, and a visible thing changes in the world within the
same session. If that moment doesn't feel good, no amount of world #2 through #8 will save it.

---

## 8. Pipeline to minimise rework  *(answers Q8)*

The rework in projects like this comes from art being re-exported by hand. Automate the boundary.

```
Aseprite (.aseprite = source of truth for every sprite)
   └─ aseprite CLI --sheet-pack --data atlas.json --format json-array
Tiled (.tmx = source of truth for the map)
   └─ export .tmj (JSON) + a script that splits the object layer into props.json
npm run assets   ← one command runs both, writes into /public/assets
```

Rules that pay for themselves:

- **Never hand-edit anything in `/public/assets`.** It is build output. Treat it like `dist/`.
- **One master palette, enforced.** `art/dreamdca-48.gpl` (delivered). Load it in Aseprite as an
  indexed palette and work in Indexed colour mode, not RGB. This makes off-palette colours
  *impossible* rather than merely discouraged, and it is the single highest-leverage thing you can
  do for cross-world visual consistency.
- **A CI check that fails the build** if any PNG in `art/` contains a colour outside the palette,
  or contains an alpha value that isn't 0 or 255. Fifteen lines of Python. Catches every problem
  found in section 1 of this document, permanently.
- **Naming is a contract:** `char_player_walk_south_0.png`, `prop_cottage_lv3.png`,
  `tile_grass_blob_23.png`, `fx_water_river_1.png`. Locked in `ASSET_SPEC.md`.
- **Lock the spec before commissioning any art.** An artist who delivers 40 sprites at the wrong
  baseline has done 40 sprites of rework.

---

## 9. Visual language across the eight worlds  *(the "don't look like a dashboard" question)*

Two separate problems, often confused.

### Stopping the *world* from reading as rectangles

- Never let a building be an untextured box. Every structure needs a roof plane at a different
  angle from its walls, an overhang casting a hard 1–2 px shadow, and at least one asymmetric
  detail (a leaning sign, a bucket, a crooked shutter).
- Break every straight line. Paths get eroded edges, fences lean, crop rows are irregular.
  Your key art already does this well — it is why it reads as handmade.
- **Ban 90° corners on organic material.** Grass→dirt, land→water: always blob-autotiled with
  irregular edges, never a straight seam.
- Density gradient: dense detail at the frame edges (trees, rocks), open walkable space in the
  middle. Your key art nails this.
- One consistent light direction (top-left) and one consistent shadow colour, everywhere, forever.

### Stopping the *UI* from reading as a dashboard

- **Diegetic panels only.** Every HUD surface is a carved wooden sign or a parchment scroll,
  drawn as a 9-slice with hard pixel borders. Zero `border-radius`. Zero `box-shadow`. Zero
  `rgba()` glassmorphism.
- **A bitmap font, not a system font.** This is the single biggest tell. One line of Inter or
  SF Pro anywhere on the game screen and the illusion is gone.
- Progress is a **carved wooden gauge with notched segments**, not a rounded bar.
- Buttons are **pressed-in pixel bevels** (2px light top-left, 2px dark bottom-right), inverted
  on press.
- The *data* screens (calendar, purchase entry) are allowed to be more conventional and legible —
  they're a "ledger book" you open, not the world. Frame them as an in-world book/journal and
  you get usability without breaking fiction.

### Consistency across BTC / ONDO / BIO / SOL / …

Build a **world kit**, and let each world differ only in three controlled dimensions:

1. **Shared, identical across all worlds:** the 48-colour master palette, tile size, camera angle,
   light direction, character scale, HUD chrome, path/water/fence/bridge tech, and the *structural
   grammar* — every world has a home node, a goal vault, a path spine, a water feature, and
   milestone slots in the same relative composition.
2. **Palette sub-selection:** each world uses the same 48 colours but weights different ramps.
   BTC = grass + wood + gold. SOL = stone + cloth + bloom (neon-teal city). BIO = stone + foliage +
   bloom (clinical greens). This is why one master palette matters — it makes eight worlds look
   like one game instead of eight asset packs.
3. **3–5 signature props each:** BTC gets a vault and a coop. ONDO gets a trading hall and
   loading docks. That's the whole differentiation budget. Resist more.

Being disciplined here is what will let world #2 take two weeks instead of two months.

---

## 10. Roadmap

Assumes one developer plus part-time pixel artist. Halve the art weeks if you have a full-time artist.

| Phase | Duration | Output | Done when |
|---|---|---|---|
| **0 — Lock specs** | 2 days | `ASSET_SPEC.md` signed off, palette locked, test bench checked on a real phone | Nobody has to ask "what size?" again |
| **1 — Engine skeleton** | 3 days | Vite+React+Phaser, integer scaling, placeholder-colour tilemap, player walking with collision + Y-sort | A magenta rectangle walks behind a green rectangle, pixel-perfect on your phone |
| **2 — Ledger core** | 4 days | Entry model in sats, pure derived-state pipeline, IndexedDB, export/import, unit tests on avg cost + backfill | Backfilling a January purchase in August yields correct totals |
| **3 — Terrain art** | 1 week | Grass/dirt/stone/water/crop tilesets with blob autotiling, in Tiled | The one-screen map is walkable and pretty with zero props |
| **4 — Props & cottage** | 1 week | Cottage lv1–4, vault, coop, bridge, fences, trees, rocks, chests | Props load from manifest; toggling a flag adds a chest |
| **5 — Characters** | 1 week | Player 4-dir walk+idle, chicken, dog, one NPC | Nothing bobs. Baselines are pixel-identical across frames |
| **6 — FX** | 3 days | Water animation, chimney smoke, canopy sway, chest sparkle | The world feels alive when you stand still |
| **7 — HUD & screens** | 1 week | 9-slice RPG chrome, bitmap font, purchase entry, 2026–27 calendar, month view + backfill | A stranger can record a purchase without instruction |
| **8 — Progression** | 4 days | Milestone JSON table, diffed unlock notifications, house-level swap, batched summary | Recording a purchase visibly changes the world in-session |
| **9 — Polish & soak** | 1 week | Perf on a mid-range Android, edge cases (DST, leap day, timezone), empty state, onboarding | 60fps on a 3-year-old phone |

**≈ 7–8 weeks to a genuinely good vertical slice.** Then, and only then, world #2.

---

## 11. Ordered asset list — what to make first

Strict dependency order. Do not skip ahead.

1. **Master palette** ✅ delivered (`art/dreamdca-48.gpl`, `art/palette.png`)
2. Terrain: grass base + 3 variations, dirt, stone path, crop soil — with blob autotile sets
3. Water: still, flowing, shoreline foam (3 frames each)
4. **Cottage lv1–4** — the hero asset; if this isn't beautiful nothing else matters
5. Player: idle ×4 directions, walk ×4 frames ×4 directions (20 frames, 32×48)
6. HUD 9-slice frame + bitmap font + wooden progress gauge
7. Vault, chicken coop, bridge, fence set, sign
8. Trees (trunk + canopy as **separate** sprites, for depth sorting), rocks, bushes, flowers
9. Chicken, dog
10. Chests, lantern, milestone decorations
11. NPC #1

---

## 12. Decisions I need from you before writing code

1. **Engine:** do you accept dropping Godot for React + Phaser 3? *(If web is truly a target, I
   think this is close to forced.)*
2. **Walkable or diorama?** The whole spec assumes a walkable character. If the world were a
   living diorama you look at, you would delete collision, camera, 20 player frames and about two
   weeks — and the app would still deliver the emotional payload. Worth 10 minutes of thought
   before you commit to walkable.
3. **What is the primary progress metric?** BTC-to-goal (demotivating for 2 years, see §6) or
   days-recorded/streak (completable, controllable, on-principle)?
4. **Who draws the art?** This determines whether I build against final assets or against a
   placeholder set I generate procedurally so engineering isn't blocked.

Answer 1 and 2 and I can start on Phase 1 immediately.

---

**Sources on Godot web export constraints:**
[Godot 4.5 Web Export WASM Memory Ceiling — 2026 playbook](https://gamineai.com/blog/godot-4-5-web-export-wasm-memory-ceiling-h2-2026-browser-demo-trend-playbook) ·
[Web Export in 4.3 — Godot Engine](https://godotengine.org/article/progress-report-web-export-in-4-3/) ·
[iOS Safari supported platform? — godotengine/godot#26554](https://github.com/godotengine/godot/issues/26554)
