# Dream DCA — Handoff to Claude Code

**Read this first, in full, before writing any code.** It is self-contained: you will not have
access to the conversation that produced it.

You are picking up a project that has been through concepting and a throwaway prototype. Your job
is to build the real thing. Everything below marked **LOCKED** is decided — do not re-open it,
do not "improve" it. Everything marked **OPEN** is yours to decide or to ask about.

---

## 1. What this is

A mobile-first web app where recording real crypto purchases grows a 16-bit pixel-art world.

The governing principle, in the owner's words:

> Not "a finance dashboard where a pixel farm is decoration."
> The opposite: "a cozy RPG world whose growth quietly represents the user's saving journey."

**The single hardest thing to get right** is that the world must never feel like a skin over a
spreadsheet. If a design choice makes the app more legible as a finance tool but less believable
as a place, choose the place.

### The rule that must never be broken

**World condition is NEVER tied to market price.** The homestead does not decay, burn, flood, or
downgrade when the market falls. Progress comes only from: recording purchases, completing
calendar days, maintaining streaks, and reaching accumulation milestones. A user who has lost
money must still open the app to a world that grew.

---

## 2. LOCKED decisions (with the reasoning — do not undo these)

| # | Decision | Why (this is the part that matters) |
|---|---|---|
| L1 | **React + Vite + TypeScript + Phaser 3.** Not Godot. | ~70% of the app is forms, a 730-day calendar, number keyboards, date pickers, and text entry. The web gives these for free; a game engine makes you rebuild them badly. A Godot web build also ships a multi-MB WASM runtime before any art, and iOS Safari is its weakest target. Phaser core is ~1MB. Capacitor later gives app stores with no rewrite. |
| L2 | **Tile size 32×32.** | 48px yields 7.5 tiles across a portrait phone — the world stops reading as a *place*. 16px cannot hold the established art density. 32 is also a power of two. Verified visually; see `dreamdca-testbench.html`. |
| L3 | **Internal render resolution 360×640.** Integer scaling only, nearest-neighbour. | 9:16. On a 390×844 CSS / DPR-3 phone it renders at exactly 3× = 1080×1920 device px. `scale = max(1, floor(min(vw/360, vh/640)))`, applied as a CSS transform on a fixed-size canvas. **Never resize the canvas backing store to a fractional multiple.** Extend vertically rather than letterbox. |
| L4 | **Character frames 32×48**, feet anchored to a fixed baseline. | ~1.5 tiles tall. 48×64 or 64×64 makes a giant on a 32px grid and eats the portrait screen. |
| L5 | **The ledger is the only source of truth. Everything else is a pure function of it.** | `ledger → derived → unlocks → worldState → scene`. The app must support backfilling historical purchases; with mutable world state that means replaying months of milestone side-effects. With a pure pipeline, you insert an entry, recompute, and the world is simply correct. This is the highest-leverage decision in the codebase. |
| L6 | **Integers only. BTC as satoshis, fiat as cents.** | `0.1 + 0.2 !== 0.3` will silently corrupt a two-year savings record. Never store floats. `priceAtBuy` is *derived* (`fiatCents / (sats/1e8)`), never stored. |
| L7 | **Hybrid world construction.** Terrain = Tiled tilemap (static for the life of the save). Props = free-positioned sprites from a JSON manifest (this is the layer progression mutates). Entities = spawned in code. | A baked background can't change with progression without combinatorial art. Forcing a 144px-wide cottage into 32px tile cells is what makes worlds look like Lego. |
| L8 | **Collision is decoupled from art. Depth is Y-sorted on ground-contact.** | A tree's collider is a ~24×16 box at the trunk base, never its canopy bounds. `sprite.depth = round(sprite.y + anchorY)` where `anchorY` is the ground-contact row. One rule handles cottages, fences, trees, signs identically. |
| L9 | **48-colour master palette, enforced by CI.** `art/dreamdca-48.gpl` | Work in Aseprite *Indexed* mode so off-palette colours are impossible rather than merely discouraged. This is what will make 8 worlds look like one game instead of eight asset packs. |
| L10 | **Canvas text is ASCII-only (5×7 bitmap). All Thai lives in the HTML layer.** | Thai needs stacked vowels + tone marks; a 5×7 cell physically cannot hold ก + ่ + ิ. Building a Thai pixel font is a multi-week project. Split: HUD numbers/labels = bitmap ASCII in canvas; dialogue, forms, calendar, settings = Thai in HTML styled with the same wooden 9-slice chrome. Proven in the prototype — the fiction holds. |
| L11 | **One character rig, N costumes.** 32×48, 20 frames, shared skeleton; each world's character differs only in clothing pixels + one held prop. | 8 unique characters = 160 original frames. One rig + 7 costume passes ≈ 20 frames + recolour work. See `dreamdca-worlds-hub.html` for all 8 rendered from one function. |
| L12 | **`west` is a horizontal mirror of `east`.** Never authored separately. | Halves character art budget, guarantees consistency. |

---

## 3. REJECTED — do not re-propose

| Rejected | Why |
|---|---|
| **Godot** (was the owner's initial preference) | See L1. Revisit only if the web target is formally abandoned. |
| **Reusing the AI-generated sprite sheets** | Measured: 62k–650k unique colours per sheet, **zero pixel grid** at any block size 2–12, max alpha **254** (no fully-opaque pixel exists), 33–65% partial alpha, baseline drift up to 48px between frames. Downscaling one player frame to 32×48 yields **901 colours in 1,536 pixels**. They are paintings of pixel art, not pixel art. **Keep them as the visual bible; never ship them.** |
| **Using the key-art scene as the game background** | 941×1672 raster with UI baked in, no alpha, no tile grid. |
| **48×48 tiles / 64×64 characters** | See L2, L4. |
| **A camera / scrolling map in the MVP** | The MVP map is exactly one screen (11×20 tiles). This removes camera code, culling, and ~60% of terrain art. A cozy world fully visible at once is *better*. Add scrolling with world #2. |
| **A live price API in the MVP** | The world deliberately ignores market price, so there is nothing to fetch. Zero API keys, zero rate limits. The user enters the price they paid. |

---

## 4. OPEN — decide these with the owner before they block you

1. **Primary HUD metric.** The owner chose **streak / days-recorded** over BTC-to-goal, and the
   real data proves it right (see §5 — BTC is at 0.07% of goal; a BTC progress bar would sit near
   zero for two years). **Recommended: lock streak-first.** Confirm before building the HUD.
2. **Early stage gating.** Stages 1–4 should likely key off *streak / days recorded*, and only
   stage 5+ off accumulated coin. This makes the world change on the user's **first recorded
   purchase**, which is the whole emotional payload. Confirm the exact thresholds.
3. **Which world ships first.** BTC Homestead is the flagship, but its real data is 0.07%.
   BIO (76.9%) and ONDO (54.9%) have real data. Recommendation: **ship BTC Homestead** — starting
   from a bare plot is the genre's core promise — but use BIO/ONDO data during development to
   verify the late stages render well.
4. **Cost-basis display for coins with sells.** BIO and RENDER have realized profits. Accounting
   cost basis and effective cash cost differ materially (BIO: $0.0371 vs $0.0261). Pick one as
   the headline and label it, or show both.
5. **Who draws the art.** Until answered, build against procedural placeholders so engineering
   is never blocked. The prototypes show this works.
6. **RENDER** exists in the data (180.9 held) but has no world and no goal in the owner's design table.

---

## 5. Real data (extracted and verified from two Binance Spot Trade History PDFs)

Period 2023-12-31 → 2026-08-10 (UTC+10). **Spot trades only — not wallet balances.** Excludes
Deposit/Withdraw, Convert, Earn, Rewards, Transfer, Token migration.

| Coin | World | Net holdings | Goal | Progress | Cash still in |
|---|---|---|---|---|---|
| BIO | Research Laboratory | 153,764.5785 | 200,000 | **76.9%** | $4,005 |
| ONDO | Business City | 21,953.4246 | 40,000 | **54.9%** | $7,665 |
| SOL | Technology City | 15.083901 | 40 | **37.7%** | $1,578 |
| LINK | Network World | 50.42952 | 500 | **10.1%** | $659 |
| **BTC** | **BTC Homestead** | **0.00013986** | **0.2** | **0.07%** | **$9** |
| RENDER | (none assigned) | 180.8971 | — | — | −$324 (realized profit) |
| AAVE / PENDLE / CC | 3 worlds | no data at all | 30 / 1,000 / 10,000 | — | — |

**BTC has exactly one trade in the entire history:** 2026-02-19 21:36, 0.00014 BTC @ $66,700 = $9.34.

Machine-readable: `dreamdca_ledger_seed.json` (every fill, per coin).
Human-readable: `DreamDCA_All_Worlds_Status.xlsx` (7 tabs, live formulas).

> **The `0.0418 BTC / 20.9% / House Level 3` in every mockup is invented sample data.** Do not
> treat it as a target state or as evidence about real user progress.

---

## 6. The 8 worlds (owner's design, authoritative)

| Coin | World | Character | Unlock ladder |
|---|---|---|---|
| BTC | บ้านหลักและอาณาจักรสะสมทรัพย์ | นักสร้างบ้าน / นักผจญภัย | เต็นท์ → บ้านเล็ก → บ้านใหญ่ → คฤหาสน์ → Bitcoin Citadel |
| ONDO | เมืองการเงินและอสังหาริมทรัพย์ | นักธุรกิจใส่สูท / developer ถือแบบแปลน | สำนักงาน → ธนาคาร → อาคารสูง → Financial District |
| BIO | เมืองห้องทดลองและสวนชีวภาพ | นักวิจัยเสื้อกาวน์ | โต๊ะทดลอง → ห้องแล็บ → Greenhouse → Bio Research Campus |
| LINK | เมืองหอส่งสัญญาณ | วิศวกร / นักส่งสารสะพายสายเคเบิล | เสาเล็ก → Relay Tower → เครือข่ายสะพาน → Oracle Network |
| SOL | เมืองความเร็วสูง | นักสเก็ต / courier | จักรยาน → รถไฟความเร็วสูง → Neon Transit → Solar Tech City |
| AAVE | เมืองธนาคารและระบบกู้ยืม | นายธนาคารถือกุญแจห้องนิรภัย | ร้านแลกเงิน → ธนาคาร → Vault → Liquidity Harbor |
| PENDLE | ตลาดเวลาและหอนาฬิกา | ช่างทำนาฬิกา / นักเดินทางข้ามเวลา | นาฬิกาเล็ก → Clock Shop → Time Market → Grand Time Tower |
| CC / Canton | เครือข่ายการเงินระดับสถาบัน | สถาปนิกเครือข่าย / ผู้ดูแลศูนย์ข้อมูล | สะพานเล็ก → Data Center → Institutional Hub → Canton Network City |

**Cost control — build 4 kits, not 8 worlds.** Worlds sharing a kit share the terrain tileset,
paths, water, fences and shadows; they differ only in palette weighting (same 48 colours) and
3–5 signature buildings.

- `rural` — BTC, PENDLE
- `urban` — ONDO, SOL, CC
- `lab` — BIO
- `keep` — AAVE
- `grid` — LINK, CC

**Structural grammar, identical in every world:** a home node, a goal vault, a path spine, a water
or barrier feature that gates late-game access, and milestone slots — in the same relative
composition. This is what makes world #2 take two weeks instead of two months.

---

## 7. Architecture

```
ledger (append-only, IndexedDB)
   │ pure
   ▼
derived   { totalSats, totalFiatCents, avgCostBasis, daysRecorded, streak }
   │ pure
   ▼
unlocks   Set<milestoneId>     ← from a declarative JSON milestone table
   │ pure
   ▼
worldState { stage, visibleProps[], activeEntities[] }
   │
   ▼
Phaser scene reconciles (add/remove sprites — never reload the scene)
```

```ts
type Entry = {
  id: string;
  date: string;        // "2026-08-14" — LOCAL calendar day. No time, no timezone.
  sats: number;        // integer
  fiatCents: number;   // integer
  note?: string;
};
```

**Milestones are data, not code:**

```json
[{ "id":"crop_plot", "requires":{"sats":4000000}, "grants":["prop.crops","prop.scarecrow"] },
 { "id":"steady_7",  "requires":{"streak":7},     "grants":["prop.bench"] }]
```

**Prop manifest** (exported from a Tiled object layer):

```json
{ "id":"cottage", "sprite":"prop_cottage_lv3", "x":176, "y":288,
  "anchorY":136, "footprint":{"x":8,"y":96,"w":144,"h":40},
  "unlock":null, "interact":"enter_house", "worldStage":0 }
```

`footprint` is authored explicitly — **never derived from sprite bounds** (L8).

**Milestone notifications come from a diff, not an event.** Persist `lastSeenUnlocks`; after any
recompute, `newlyUnlocked = unlocks − lastSeenUnlocks`. If the user backfills six months at once,
batch into a single "your homestead grew while you were away" summary — never twenty popups.

### Stack

```
Vite + React 18 + TypeScript
Phaser 3       world rendering, mounted only on the World screen
Zustand        single store; the bridge between app state and the scene
Dexie          IndexedDB persistence + JSON export/import
Tiled          map authoring → .tmj + props.json
Aseprite       all sprite authoring → PNG atlas + JSON (CLI, via `npm run assets`)
```

Phaser never owns financial data. It reads a snapshot of `worldState` from the store.

---

## 8. Known bugs and traps (found the hard way — do not rediscover these)

1. **Never use `toISOString().slice(0,10)` for date keys.** It returns the **UTC** date. In
   Australia/Sydney (the owner's timezone) this made the streak counter walk
   `14 Aug → 12 Aug → 10 Aug` — counting every *other* day. Use local date parts:
   ```ts
   const iso = (d: Date) =>
     `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
   ```
   Write a test that runs under at least Sydney, UTC and Los_Angeles.
2. **Alpha must be binary.** Every art pixel is alpha 0 or 255. Partial alpha renders as a grey
   halo around every sprite. Enforce in CI.
3. **Terrain that belongs to progression must not render early.** The crop-plot *soil* is part of
   the reward, not part of the base terrain — gate the tile, not just the props on it.
4. **Gate water crossings.** Keeping the bridge locked until a late stage creates visible-but-
   unreachable land, which is a strong retention hook. Make sure the collision grid updates when
   the bridge unlocks.

---

## 9. Phase 1 — build this, nothing more

One screen, 11×20 tiles, no camera scroll.

1. Vite + React + Phaser skeleton with correct integer scaling (L3)
2. Player: 4-direction walk (4 frames) + idle, 32×48, collision, Y-sort (L8)
3. Terrain from a Tiled map; props from `props.json`
4. Ledger in sats/cents (L6), pure derived pipeline (L5), Dexie persistence
5. Purchase entry (HTML form, native inputs, live sats + avg-cost calculation)
6. Calendar: month view, 2026–2027, tap any day to backfill
7. HUD: 9-slice wooden chrome, 5×7 bitmap ASCII, streak as the headline metric
8. 5 milestones from JSON, batched unlock notification
9. Autosave + **JSON export/import** (non-negotiable — see below)
10. Animated water + chimney smoke, 2 chickens, 1 dog, 1 idle NPC

**Explicitly NOT in Phase 1:** camera follow, cow, NPC dialogue trees, audio, worlds 2–8,
accounts, cloud sync.

### Acceptance criteria

- [ ] Pixel-perfect at integer scale on a real phone; no blur at any viewport size
- [ ] Player walks behind a tree, then in front of it, with no special-casing
- [ ] Recording a purchase visibly changes the world **in the same session**
- [ ] Backfilling a January purchase in August yields correct totals and fires **one** batched
      notification, not many
- [ ] Streak is correct under Sydney, UTC and Los_Angeles (unit test)
- [ ] Data survives: export JSON → clear site data → import → identical state
- [ ] No system font anywhere on the world screen
- [ ] 60fps on a three-year-old mid-range Android

### Before this can be used for real

The prototype is ~27% of this MVP. Four things block real daily use, in priority order:

1. **No seed data.** Ship an empty state, not 23 invented days.
2. **Export/import JSON + a backup reminder.** Data currently lives in one browser's storage;
   clearing site data destroys a two-year record. **This is the single most important item.**
3. **Edit and delete entries.** A typo is currently permanent.
4. Deploy to a URL + PWA manifest so it can be added to the home screen.

Ship those four and the owner can start recording real purchases on day one, while the art is
still placeholder — which is the correct sequencing, because data accrues while art is drawn.

---

## 10. Files in this handoff

| File | What it is |
|---|---|
| `HANDOFF.md` | This document |
| `docs/AUDIT.md` | Full technical audit — the reasoning behind every locked decision |
| `docs/ASSET_SPEC.md` | **Lock before commissioning any art.** Frame sizes, animation FPS, naming, CI validator, Thai-font constraint |
| `art/dreamdca-48.gpl` | Master palette, Aseprite/GIMP format |
| `art/palette.png` | Visual palette sheet |
| `btc-homestead-slice.html` | **Playable prototype.** Walk, collide, Y-sort, record a purchase, backfill via calendar, milestone unlock, localStorage. Plain canvas, not Phaser — the *behaviour* is the reference, not the code |
| `btc-homestead-stages.html` | Stage progression 0%→100% with a slider. Use to design the empty state |
| `dreamdca-worlds-hub.html` | All 8 worlds + all 8 characters from one rig, at real progress |
| `dreamdca-testbench.html` | Tile-size / resolution comparison. Includes a "dashboard HUD" toggle showing the failure mode to avoid |
| `dreamdca_ledger_seed.json` | Every real trade fill, per coin |
| `DreamDCA_All_Worlds_Status.xlsx` | Same data, human-readable, live formulas |

The four HTML files are **single-file prototypes with procedural placeholder art**. Read them for
behaviour and layout. Do not port their rendering code — rebuild properly on Phaser with real
sprite atlases.

---

## 11. How to start

1. Read `docs/ASSET_SPEC.md` end to end. Get §9's sign-off checklist agreed.
2. Open `dreamdca-testbench.html` on a real phone and confirm 32px / 360×640 with the owner.
3. Confirm the two OPEN items that block the HUD: primary metric, and early-stage gating.
4. Scaffold the project, wire integer scaling, and get a coloured rectangle walking behind
   another coloured rectangle — pixel-perfect on a phone — before touching any art.

Ask about anything in §4. Do not silently reverse anything in §2 or §3; if you believe a locked
decision is wrong, say so explicitly and explain why before changing it.
