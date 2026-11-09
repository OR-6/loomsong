# Loomsong (working title)

A hands-only mixed-reality puzzle game for Meta Quest, built with Meta's Immersive Web SDK (IWSDK 1.0.1, WebXR). A tiny loom sits on your real desk. Slide levers to lift threads, slide the shuttle across, and hear the cloth play.

**Play:** https://or-6.github.io/loomsong/ (open in Meta Quest Browser, hand tracking on). Milestone snapshots stay at https://or-6.github.io/loomsong/m0/, /m1/, /m2/ and /m3/.

**Status:** M3. Levels 1–3 are authored; from level 4 they are generated (seeded, solvable by construction, scored against a computed par) and continue endlessly. Features:
- set-the-table placement, with a no-hand fallback and nudge arrows;
- pinch-slide or poke levers;
- shuttle passes that strum;
- woven cloth that plays back as a melody;
- target card, undo bobbin, stars and a star-total nameplate;
- share links (`#w=`) that start a "weave this" challenge;
- "Fit to my hands" calibration;
- high-contrast and lever-side settings;
- an unlockable Workshop style;
- an optional spatial anchor;
- a frame-time guard that sheds effects under load.

Emulator E2E covers Level 1 (first run), generated Level 4, the no-hand fallback, high contrast, cloth rendering, calibration and a shared-cloth challenge. Everything is verified in the IWSDK emulator only; it has **not** yet been run on a headset.

## Run

```bash
npm install
npm run dev          # IWSDK-managed dev server + emulator (https://localhost:8081)
npm test             # unit tests (vitest)
npm run check:reach  # R2: every interactable within 60 cm of the seated head
npm run test:e2e     # emulator E2E (needs: npx @iwsdk/cli dev up --ai-mode agent --headless --allow-browser-automation)
npm run build        # static build in dist/
```

Dev URL params:
- `?desk=<y>` fixes the desk height (metres).
- `?noise=1` injects hand-tracking jitter and dropouts.
- `?probe` (dev builds only) publishes raw joint data for diagnostics.
- `?degrade=1|2` forces the frame-guard quality level.
- `#w=<code>` opens a shared cloth as a challenge.

## Docs

- `docs/IWSDK-NOTES.md`: platform findings, with evidence.
- `docs/ART-DIRECTION.md`: the "toy loom" visual direction.

The full README (hard requirements, libraries and licences, accessibility statement, known limits, judge instructions) will be written before submission.

## Credits and licences

- Display font: **Lilita One** by Juan Montoreano, SIL Open Font License 1.1. It is bundled unmodified; the licence is in `public/fonts/LilitaOne-OFL.txt`.
- Workshop font: **Fraunces** (72pt Soft SemiBold) by The Fraunces Project Authors, SIL Open Font License 1.1. It is bundled unmodified; the licence is in `public/fonts/Fraunces-OFL.txt`.
- Built on Meta's Immersive Web SDK (`@iwsdk/core`, MIT) and Three.js (MIT, via `super-three`).
- All geometry, textures and audio are generated in code. There are no image or audio files.
