# Decisions

`HANDOFF.md` §2 lists the LOCKED decisions and §3 the REJECTED ones — those are closed and are not
repeated here. This file records the §4 OPEN items and anything decided since.

---

## §4 OPEN items — resolved 2026-08-14

| # | Item | Decision | Reasoning |
|---|---|---|---|
| 1 | Primary HUD metric | **Streak / days recorded** | Locked as recommended. BTC sits at 0.07% of goal; a BTC progress bar would read as near-zero for two years, which violates the "never shame the user" principle. BTC accumulation is shown separately as the long horizon. |
| 2 | Early stage gating | **Stages 1–4 key off streak / days recorded; stage 5+ keys off accumulated coin** | Makes the world change on the *first recorded purchase*. That moment is the whole emotional payload; gating it behind an amount would delay it by months. Exact thresholds live in the milestone JSON, which is data — tune without touching code. |
| 3 | Which world ships first | **BTC Homestead** | Starting from a bare plot is the genre's core promise. BIO (76.9%) and ONDO (54.9%) real data is used during development to verify the late stages render well. |
| 4 | Cost-basis display for coins with sells | **Effective cash cost is the headline, labelled; accounting cost basis shown as a secondary line** | BIO differs materially ($0.0371 vs $0.0261). Showing one unlabelled number invites the user to misread it; labelling both costs one line of UI. |
| 5 | Who draws the art | **Procedural placeholders until an artist is engaged** | As the handoff directs. `src/game/placeholder.ts` draws every asset at the locked frame sizes, on-palette, with binary alpha, so the swap to real atlases is a texture-registration change. |
| 6 | RENDER (180.9 held, no world, no goal) | **No world yet** | Not in the owner's design table and has no goal. Revisit only if the owner assigns one. |

---

## Architecture pivot — 2026-08-17

Two of the resolutions above didn't survive contact with the owner's actual usage pattern and
real art. Both are reversed here, explicitly, rather than silently overwritten.

**§4.1/§4.2 reversed: accumulation replaces streak/days-recorded entirely.** The original
resolution assumed a daily-habit user and gated early stages on `daysRecorded` specifically so the
world would change on day one even though BTC accumulation looked flat. Talking through the
owner's real behaviour — converting a lump sum to USDT and buying a large chunk in one sitting,
irregularly, sometimes not for months — showed the `daysRecorded` gate would strand exactly that
user on the first scene indefinitely, which is the opposite of the intended effect. Fix: every
scene in `src/data/btc-homestead.json` is gated on **accumulated sats only** (`minSats`). Streak
and `daysRecorded` remain in `derive.ts` — cheap to keep, might matter for a future habit-shaped
world — but nothing in progression or the HUD reads them now. First purchase (any size) still
changes the world immediately, because `minSats: 1` is the second scene; that emotional payload
survives the reversal intact.

**Rendering rebuilt around real art instead of the walkable tile engine.** AUDIT.md §12.2 asked
"walkable or diorama?" and it was never firmly settled — Phase 1 built walkable by default,
without that question being explicitly re-raised. The owner then produced real BTC Homestead art
as full painted scenes (`docs/ART_PROMPTS_BTC.md`: one ChatGPT conversation, each image an
incremental edit of the last accepted one, keeping camera/lighting/composition locked across all
18 stages). That art is diorama-style — a self-contained hero shot per accumulation threshold, not
32px tiles or composable sprites. Retrofitting it into `WorldScene.ts`'s tilemap system would have
meant re-deriving tile/prop data from finished paintings for no benefit. `WorldScene.ts`,
`placeholder.ts` and `scale.ts` are deleted; `src/game/WorldView.tsx` now crossfades the current
scene's image and hosts a small, Phaser-independent HUD canvas. Phaser stays installed (L1 is
still locked) but nothing currently imports it — dropped it from the bundle for free: **391KB →
90KB gzip**.

Both changes are reflected in `CLAUDE.md`; this section is the reasoning trail for why.

---

## Sequencing — one deviation from the handoff, stated explicitly

`HANDOFF.md` §9 lists Phase 1 as ten items in engine-first order. The section immediately after it
("Before this can be used for real") names four things that block real daily use: empty state,
JSON export/import, edit/delete entries, and a deployed PWA URL.

**These two orderings conflict.** This build follows the second one: the ledger, its persistence
and its export/import land before the world is finished, because trade data accrues while art is
still being drawn, and a two-year savings record cannot be at the mercy of one browser's storage.
Nothing is cut from Phase 1 — only reordered.

---

## Verified, not assumed

Checks run against the live build rather than reasoned about (pre-pivot claims about the walkable
tile engine — integer scaling, depth sorting, collision-follows-visibility — are no longer true
statements about the shipped app and are removed rather than left stale; see the git history on
this file if that era's numbers are ever needed).

Post-pivot, against the real BTC Homestead art:

- **All 18 stage images + 2 creature sprites confirmed correctly ordered and mapped** by reading
  every file back and checking its content against `docs/ART_PROMPTS_BTC.md`'s expected sequence
  before renaming — catches a wrong save/skip before it becomes a silent off-by-one in the game.
- **A real purchase changes the world in the same session, no reload.** Recording $9.34 @ $66,700
  (the one real BTC trade in the ledger seed) produced `0.00014 BTC`, moved the world from
  `bare_land` to `first_light` (0.07% of goal — matches the historical fact in HANDOFF §5 exactly),
  and the DOM `<img>` swapped to `stage_01.webp` with no component remount.
- **Scene index 0 is excluded from unlock announcements** — a real bug the test suite caught before
  shipping (see Traps in `CLAUDE.md`), not one found by manual testing.
- **A lump-sum jump batches into ONE summary.** Recording a single 0.12 BTC entry crossed 12 scene
  thresholds (`cottage` through `chest2`) and produced exactly one unlock panel listing all 12, not
  12 popups — the owner's real "buy it all at once" pattern, not a synthetic backfill test.
- **Export → replace → import reproduces `worldState` exactly**, byte-different JSON aside
  (key-insertion order only).
- **Persistence survives reload** — scene, entries and `lastSeenSceneId` all restore from
  IndexedDB; an already-acknowledged scene does not re-announce itself.
- **Empty state is the shipped state** — after wiping the test data the world returns to
  `bare_land` / `stage_00`, zero entries, no unlock panel. No invented sample data.
- **Art CI gate correctly scoped** — `validate_art.py` no longer fails on the painted scenes
  (which were never meant to be palette-locked); `--self-test` still fails a partial-alpha PNG and
  an off-palette PNG and passes a clean one, so the gate isn't just disabled, it's aimed correctly.
- **Bundle size**: dropping the unused Phaser import took the JS needed to render the world from
  ~391KB gzip (46.9KB entry + 344KB Phaser chunk) to a single 90KB gzip bundle.
- **Image weight**: 20 ChatGPT PNGs (51MB total, ~2.7MB each) converted to WebP q82 for
  `public/art/btc/` — 6.3MB total, ~300-400KB per scene, and only the current scene is fetched at
  any moment (lazy per `<img src>`, not preloaded as a set).

---

## Deployed — 2026-08-16

Live at **https://tompaoc.github.io/DreamDCA/**. Repo: [tompaoc/DreamDCA](https://github.com/tompaoc/DreamDCA)
(public), deployed via `.github/workflows/deploy.yml` on every push to `main`
(`test:tz` → `validate_art.py` → build → GitHub Pages, using GitHub-hosted Pages'
Actions build source rather than a `gh-pages` branch).

- **Installable PWA**: manifest + service worker via `vite-plugin-pwa`. Icon set drawn procedurally
  from the same 48-colour palette (`scripts/make_icons.py`) at integer multiples of a 32px master —
  no anti-aliasing, so the home-screen icon is the same art language as the game.
- **`registerType: "prompt"`, not `"autoUpdate"`.** A savings tracker must not swap its code out
  from under someone mid-purchase-entry; a wooden banner offers the new build, nothing changes
  until it is tapped. Verified live: rebuild → banner appears → tap → new code runs → a ledger
  entry recorded *before* the update is still there after, because the ledger (IndexedDB) is never
  part of the service worker's cache — only the static app shell is.
- **Verified fully offline**: with the server stopped, a reload still rendered the whole app —
  world, HUD, action bar and the ledger's own empty state — from cache + IndexedDB alone.

## Open

- **Bitmap font** — no external face is chosen or licensed. The HUD currently uses an in-repo 5×7
  ASCII face (`src/game/font.ts`), which satisfies L10 and costs nothing; licensing a nicer face is
  still open.
- **Creature sprites not composited.** `sprite_dog.webp` / `sprite_chicken.webp` exist and are
  ready, but overlaying them on the baked-in painted dog/chicken needs each scene's exact pixel
  position calibrated (stage_06 onward) — guessed placement risks a visible double-image or drift.
- **Walkable-vs-diorama is now resolved as diorama** for BTC Homestead (see the pivot above).
  Whether a *future* world (one with more room-to-room structure, say) goes walkable again is
  still genuinely open — nothing forces every world to use the same render approach.
- The old tile-size/resolution sign-off items (`AUDIT.md` §3, `dreamdca-testbench.html`) applied to
  the deleted tile engine and no longer apply to full-bleed painted scenes.
