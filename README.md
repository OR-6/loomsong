# Loomsong (working title)

A hands-only mixed-reality puzzle game for Meta Quest, built with Meta's Immersive Web SDK (IWSDK 1.0.1, WebXR). A tiny loom sits on your real desk. Slide levers to lift threads, slide the shuttle across, and hear the cloth play.

**Play:** https://or-6.github.io/loomsong/ (open in Meta Quest Browser, hand tracking on). The M0 snapshot stays at https://or-6.github.io/loomsong/m0/.

**Status:** M0 prototype. It has been verified in the IWSDK emulator only; it has **not** yet been run on a headset.

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

The full README (hard requirements, libraries and licences, accessibility statement, known limits, judge instructions) will be written before submission.
