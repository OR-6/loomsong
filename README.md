# Loomsong (working title)

A hands-only mixed-reality puzzle game for Meta Quest, built with Meta's Immersive Web SDK (IWSDK 1.0.1, WebXR). A tiny loom sits on your real desk. Slide levers to lift threads, slide the shuttle across, and hear the cloth play.

**Play:** https://or-6.github.io/loomsong/ (open in Meta Quest Browser, hand tracking on). Milestone snapshots stay at https://or-6.github.io/loomsong/m0/ and https://or-6.github.io/loomsong/m1/.

**Status:** M1. Three authored levels. Level 1 was played end to end in the emulator E2E; Levels 2 and 3 are unit-tested only. Features: set-the-table placement, pinch-slide or poke levers, shuttle passes that strum, target card, undo bobbin, stars, and the cloth plays back as a melody. Finishing levels 1–3 unlocks the alternate Workshop style. Verified in the IWSDK emulator only; **not** yet run on a headset.

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

## Docs

- `docs/IWSDK-NOTES.md`: platform findings, with evidence.
- `docs/ART-DIRECTION.md`: the "toy loom" visual direction.

The full README (hard requirements, libraries and licences, accessibility statement, known limits, judge instructions) will be written before submission.

## Credits and licences

- Display font: **Lilita One** by Juan Montoreano, SIL Open Font License 1.1. It is bundled unmodified; the licence is in `public/fonts/LilitaOne-OFL.txt`.
- Workshop font: **Fraunces** (72pt Soft SemiBold) by The Fraunces Project Authors, SIL Open Font License 1.1. It is bundled unmodified; the licence is in `public/fonts/Fraunces-OFL.txt`.
- Built on Meta's Immersive Web SDK (`@iwsdk/core`, MIT) and Three.js (MIT, via `super-three`).
- All geometry, textures and audio are generated in code. There are no image or audio files.
