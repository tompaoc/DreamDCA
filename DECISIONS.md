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

Checks run against the live build rather than reasoned about:

- **Integer scaling** — 25 unit tests, including a sweep of every viewport from 240×400 to
  2400×2400; scale is integer everywhere and CSS size is always exactly `internal × scale`.
- **Extend, never letterbox** — at 375×812 the canvas backing store measures 360×812 with
  `transform: translate(7px,0) scale(1)`. The extra 172 rows are world, not black bar.
- **Depth sorting** — with the player at y=314 (above the tree's ground contact at 327) it is drawn
  *before* the canopy; at y=340 it is drawn *after*. One rule, no special-casing.
- **Palette + binary alpha** — all 25 placeholder textures, including the baked 360×1400 terrain:
  zero partial-alpha pixels, zero off-palette colours.
- **Baseline stability** — the feet row is exactly 47 in all 4 walk frames of all 3 authored
  directions, at exactly 32×48. Nothing bobs.
- **Timezone** — the full suite passes under Australia/Sydney, UTC and America/Los_Angeles.
- **Art CI gate** — `validate_art.py --self-test` fails a partial-alpha PNG and an off-palette PNG,
  and passes a clean one.

Ledger layer, exercised against the running app:

- **A purchase changes the world in the same session** — recording $9.34 @ $66,700 (the one real BTC
  trade in the history) produced `0.00014003 BTC`, and the home node swapped `prop_tent` →
  `prop_cottage_lv1` with the lantern and signpost appearing, without a scene reload.
- **Backfill batches into ONE summary** — importing 40 consecutive backdated days in a single
  operation produced **one** panel listing 4 milestones, not 40 popups. Already-acknowledged
  milestones were correctly excluded from the diff.
- **Collision follows visibility** — a locked fence is invisible *and* its static body is disabled,
  so it cannot block a path the player is supposed to be able to walk.
- **Export → replace → import reproduces state exactly.** The derived object is identical in
  content; only `byDay` key insertion order differs in the raw JSON string, which is why the check
  compares content rather than `JSON.stringify` output.
- **Persistence survives reload** — stage, sprites and acknowledged unlocks all come back from
  IndexedDB, and an acknowledged milestone does not re-announce itself.
- **Empty state is the shipped state** — after wiping the test data the world returns to
  `ที่ดินเปล่า` with the tent, zero entries, and nothing unlocked. No invented sample data.

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
- **Not yet built from Phase 1**: animated water, chimney smoke, canopy sway, the idle NPC.
- Tile size 32 and internal resolution 360×640 are confirmed in code and in tests, but the sign-off
  checklist also asks for confirmation **on a real phone** via `prototypes/dreamdca-testbench.html`.
  The dev server binds to `0.0.0.0`, so it is reachable from a phone on the same network.
- Walkable-vs-diorama (`AUDIT.md` §12.2) is being built **walkable**, per the spec's own assumption.
