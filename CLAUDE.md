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

A mobile-first web app where recording real crypto purchases grows a painted world. Eight worlds
eventually; **BTC Homestead ships first**.

**The rule that must never be broken: world condition is NEVER tied to market price.** No decay,
no fire, no flood, no downgrade when the market falls. Progress comes only from *accumulating* —
see the "accumulation, not habit" note below for why streak/days-recorded were dropped entirely.
Someone who has lost money must still open the app to a world that grew.

Second rule, from the brief: if a design choice makes the app more legible as a finance tool but
less believable as a place, **choose the place**.

## Rendering: painted scenes, not a walkable tile engine

This is a deviation from how Phase 1 started, decided 2026-08-17 — read this before touching
`src/game/`. AUDIT.md §12.2 raised "walkable or diorama?" as an open question and it was never
firmly answered; Phase 1 built walkable by default. The owner then generated real art for BTC
Homestead as a sequence of **full painted scenes** (one evolving hand-composed image per
accumulation threshold — see `docs/ART_PROMPTS_BTC.md`), produced in ChatGPT by attaching each
accepted image back into the same conversation and asking for one incremental change at a time.
That art answers the open question: it is diorama-style, not tile/sprite-composable, and forcing
it through the old 32px tile + prop-sprite pipeline would fight the art instead of serving it.

**Consequence:** `src/game/WorldScene.ts` (Phaser tilemap scene), `placeholder.ts` (procedural
tile/sprite art) and `scale.ts` (integer tile-grid scaling) are deleted. The world is now rendered
by `src/game/WorldView.tsx` — a full-bleed `<img>` per scene, crossfaded on change, with a small
canvas HUD overlaid on top (`src/game/hud.ts`, no longer Phaser-coupled). L1 still locks Phaser
into the stack (`phaser` stays an installed dependency) — nothing currently imports it, since
BTC Homestead has no tilemap or sprite animation to run. A future world could still use it.

## Accumulation, not habit — the other reopened decision

DECISIONS.md's original §4.1/§4.2 resolution (streak/days-recorded as the primary metric and
early-stage gate) was **reversed 2026-08-17**. The owner's real behaviour is lump-sum accumulation
— e.g. converting $3,000 to USDT and buying a large chunk of a coin in one sitting, irregularly —
not daily habit. Under the old daysRecorded-gated stages, that owner would stay stuck on the first
scene for months despite being fully funded, which is the opposite of what the app is for. Every
scene and milestone is now gated on **accumulated sats alone** (`src/data/btc-homestead.json`,
`minSats`). Streak/daysRecorded are still computed in `derive.ts` (harmless, possibly useful for a
future world that *is* habit-shaped) but nothing in progression or the HUD reads them anymore.

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
derived    { totalSats, totalFiatCents, avgCostBasis, daysRecorded, streak }
   │ pure
   ▼
worldState { sceneId, image, label, progressToGoal, nextScene, progressToNext }
   │            ↑ highest scene in btc-homestead.json whose minSats <= totalSats
   ▼
WorldView reconciles (crossfades the <img>, redraws the HUD canvas — never remounts)
```

**The ledger is the only source of truth; everything downstream is a pure function of it** (L5).
This is what makes backfilling a January purchase in August free instead of a bug farm. Do not
introduce mutable world state as a shortcut.

**Integers only** (L6). BTC as satoshis, fiat as cents. `priceAtBuy` is derived
(`fiatCents / (sats/1e8)`), never stored. `0.1 + 0.2 !== 0.3` would silently corrupt a two-year
savings record.

**The view never owns financial data.** `WorldView` reads a snapshot of `worldState` from the
store; it has no ledger access of its own.

## Traps already paid for — do not rediscover

1. **Never `toISOString().slice(0,10)` for a date key.** It returns the *UTC* date; in Sydney that
   made the streak walk 14 Aug → 12 Aug → 10 Aug. Use `isoLocal()` in `src/core/date.ts`, and keep
   `npm run test:tz` green.
2. **`new Date("2026-08-14")` parses as UTC midnight** — the same bug wearing a different hat.
   Use `parseDay()`.
3. **Alpha must be binary** (0 or 255) for pixel-sprite assets — irrelevant to the painted scenes
   (see Art below), which are full RGB compositions, not tile/sprite atlases.
4. **`newlySeenScenes` must skip scene index 0.** It has `minSats: 0`, met before any entry exists,
   so a naive diff against a fresh install (`lastSeenSceneId === null`) would announce "ที่ดินเปล่า"
   (bare land) as an unlock. A real bug caught by its own test — see `progression.test.ts`.
5. **StrictMode double-mounts.** `WorldView` has no engine lifecycle to fight (no `Phaser.Game` to
   half-boot and leak), which is one of the things the rendering pivot bought for free.
6. Decimal parsing in `money.ts` is digit-by-digit, never `parseFloat` — `parseFloat("0.00014") *
   1e8` is `14000.000000000002`, not `14000`.

## Layout

```
src/core/        pure logic — date, money, derive, progression, backup. No DOM.
src/db/          Dexie (IndexedDB) persistence
src/store/       the single Zustand store; the bridge between ledger state and the view
src/ui/          Thai HTML screens — record, calendar, backup, unlock summary
src/game/        WorldView.tsx (scene crossfade + HUD host), font.ts (5x7 ASCII), hud.ts
src/data/        btc-homestead.json — scene thresholds. Data, not code.
public/art/btc/  shipped scene images, *.webp, ~300-400KB each, lazy-loaded one at a time
art/source/      full-resolution PNG originals (51MB, not shipped — see Art below)
art/             dreamdca-48.gpl master palette (48 colours; still used by the HTML/HUD chrome)
scripts/         validate_art.py — scoped to pixel-sprite assets, excludes art/source/**
docs/            AUDIT.md, ASSET_SPEC.md, ART_PROMPTS_BTC.md
prototypes/      the four original single-file prototypes — walkable-engine behavioural
                 reference, superseded by the rendering pivot above. Historical only.
data/            real Binance trade data (ledger seed + xlsx)
tests/           vitest
```

In dev builds the store is exposed as `window.__store`, so the ledger pipeline (backfill batching,
export/import round trips) can be probed from the console instead of eyeballed.

**Scenes are JSON.** To change what unlocks when, edit `src/data/btc-homestead.json` — never
branch on a threshold inside a component. The `minSats` numbers there are the same ones baked into
the prompts in `docs/ART_PROMPTS_BTC.md`; if one changes, the other must too, or the art and the
gating drift apart.

## Art

BTC Homestead's 18 scenes + 2 creature sprites are **real AI-painted art**, not placeholder —
produced via the recipe in `docs/ART_PROMPTS_BTC.md` (ChatGPT, one continuous conversation per
world, each prompt an incremental edit of the previous accepted image so the composition, camera
and lighting hold steady). Originals are ~2.7MB PNG each (1122×1402); shipped copies are WebP at
quality 82, ~300-400KB — regenerate with the one-liner in that doc's integration notes if new
source art lands. Full-res PNG originals live in `art/source/btc-homestead/` (not shipped, not
palette-checked — see `scripts/validate_art.py`'s scoping comment).

**Not yet wired up**: the two standalone creature sprites (`public/art/btc/sprite_dog.webp`,
`sprite_chicken.webp`) exist but are not composited into the scene. Doing so needs the pixel
position of the baked-in dog/chicken calibrated per scene image (stage_06 onward) — attempted
without that, an overlay sprite will either double up with the painted one or drift off it.
The only animation currently live is a whole-scene "breathing" zoom (`.scene-stack` in
`styles.css`) — cheap, safe, needs no per-image calibration, but is not the "chickens actually
walk" ask. That remains open.
