# CLAUDE.md — Dream DCA

Guidance for Claude Code working in this repo.

## Read order

1. **`HANDOFF.md`** — the brief. Self-contained, authoritative. §2 (LOCKED) and §3 (REJECTED)
   are closed decisions.
2. `docs/AUDIT.md` — the reasoning behind every locked decision. Read before arguing with one.
3. `docs/ASSET_SPEC.md` — frame sizes, animation FPS, naming, palette. Lock before commissioning art.
4. `DECISIONS.md` — the §4 OPEN items, now resolved, plus anything decided since.

## Live

**https://tompaoc.github.io/DreamDCA/** — deployed from `main` via `.github/workflows/deploy.yml`
(GitHub Pages, Actions build source). Repo: [tompaoc/DreamDCA](https://github.com/tompaoc/DreamDCA).
Installable PWA (manifest + service worker via `vite-plugin-pwa`, `registerType: "prompt"` — see
`src/pwa.ts` for why auto-update is wrong for this app). The service worker only ever caches the
static app shell; the ledger lives in IndexedDB and is never touched by an app update.

## What this is

A mobile-first web app where recording real crypto purchases grows a 16-bit pixel-art world.
Eight worlds eventually; **BTC Homestead ships first**.

**The rule that must never be broken: world condition is NEVER tied to market price.** No decay,
no fire, no flood, no downgrade when the market falls. Progress comes only from recording
purchases, completing days, streaks and accumulation milestones. Someone who has lost money must
still open the app to a world that grew.

Second rule, from the brief: if a design choice makes the app more legible as a finance tool but
less believable as a place, **choose the place**.

## Commands

Run from inside `DreamDCA/`.

- `npm run dev` — Vite dev server on :5173
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest
- `npm run test:tz` — the same suite under Australia/Sydney, UTC and America/Los_Angeles.
  **Run this before touching anything date-related.**
- `npm run build` — typecheck + production build
- `python scripts/validate_art.py` — art CI gate (palette + binary alpha)
- `python scripts/validate_art.py --self-test` — proves the gate fails on a bad PNG

### Environment gotcha

Node was installed after this machine's shell profile was captured, so `node`/`npm` are **not on
PATH in a fresh PowerShell tool call**. Prefix commands with:

```bash
$env:Path += ";C:\Program Files\nodejs"
```

The preview launcher (`C:\Project\.claude\launch.json`, entry `dreamdca`) works around the same
thing by invoking `node.exe` by absolute path.

## Architecture — the one thing not to break

```
ledger (append-only, IndexedDB)
   │ pure
   ▼
derived   { totalSats, totalFiatCents, avgCostBasis, daysRecorded, streak }
   │ pure
   ▼
unlocks   Set<milestoneId>          ← declarative JSON milestone table
   │ pure
   ▼
worldState { stage, visibleProps[], activeEntities[] }
   │
   ▼
Phaser scene reconciles (add/remove sprites — never reload the scene)
```

**The ledger is the only source of truth; everything downstream is a pure function of it** (L5).
This is what makes backfilling a January purchase in August free instead of a bug farm. Do not
introduce mutable world state as a shortcut.

**Integers only** (L6). BTC as satoshis, fiat as cents. `priceAtBuy` is derived
(`fiatCents / (sats/1e8)`), never stored. `0.1 + 0.2 !== 0.3` would silently corrupt a two-year
savings record.

**Phaser never owns financial data.** It reads a snapshot of `worldState` from the store.

## Traps already paid for — do not rediscover

1. **Never `toISOString().slice(0,10)` for a date key.** It returns the *UTC* date; in Sydney that
   made the streak walk 14 Aug → 12 Aug → 10 Aug. Use `isoLocal()` in `src/core/date.ts`, and keep
   `npm run test:tz` green.
2. **`new Date("2026-08-14")` parses as UTC midnight** — the same bug wearing a different hat.
   Use `parseDay()`.
3. **Alpha must be binary** (0 or 255). Partial alpha renders as a grey halo around every sprite.
4. **Collision is never derived from sprite bounds** (L8). A tree's collider is a ~24×16 box at the
   trunk base, authored explicitly in `props.json` as `footprint`.
5. **Depth is the ground-contact row**, not sprite y: `depth = round(y + anchorY)`. A tree canopy
   sorts at its trunk's base, which is why its `anchorY` legitimately exceeds its sprite height.
6. **Scale must be an integer.** `Phaser.Scale.FIT` produces fractional scales and mushy pixels —
   scale mode is `NONE` and the geometry comes from `src/game/scale.ts`.
7. **StrictMode double-mounts.** Phaser is booted in a deferred task and cancelled on unmount;
   destroying a half-booted `Phaser.Game` leaves its canvas in the DOM, on top of the live one.
8. Terrain that belongs to progression must not render early — gate the *tile*, not just the props
   standing on it.

## Layout

```
src/core/        pure logic — date, money, derive, progression, backup. No DOM, no Phaser.
src/db/          Dexie (IndexedDB) persistence
src/store/       the single Zustand store; the bridge between app state and the scene
src/ui/          Thai HTML screens — record, calendar, backup, unlock summary
src/game/        Phaser: scale.ts (integer scaling), font.ts (5x7 ASCII), hud.ts,
                 placeholder.ts (procedural art), scenes/
src/data/        props.json, colliders.json, progression.json — data, not code
art/             dreamdca-48.gpl master palette (48 colours, CI-enforced)
scripts/         validate_art.py
prototypes/      the four single-file prototypes. Read for BEHAVIOUR, never port their code.
docs/            AUDIT.md, ASSET_SPEC.md
data/            real Binance trade data (ledger seed + xlsx)
tests/           vitest
```

In dev builds the game and the store are exposed as `window.__dd` and `window.__store`, so the
render and the ledger pipeline can be probed from the console instead of eyeballed.

**Milestones, stages and props are JSON.** To change what unlocks when, edit
`src/data/progression.json` — never branch on a threshold inside a scene.

`prototypes/*.html` open directly in a browser and are the behavioural reference for walking,
collision, purchase entry, calendar backfill and milestone unlock.

## Art

All current art is **procedural placeholder** (`src/game/placeholder.ts`), drawn from the 48-colour
palette with binary alpha, at the frame sizes locked in `ASSET_SPEC.md` §2. It exists so
engineering is never blocked on an artist. Replacing it with real Aseprite atlases should not
require changes beyond swapping the texture registration.

Do **not** reuse the AI-generated sprite sheets. Measured: 62k–650k unique colours, no pixel grid,
max alpha 254, baseline drift up to 48px between frames. They are the visual bible, not assets.
