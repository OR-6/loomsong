# Loomsong (working title)

A hands-only mixed-reality puzzle game for Meta Quest, built with the Immersive Web SDK (IWSDK 1.0.1, WebXR).

A tiny toy loom unfolds on your real desk. Slide a lever away from you to lift threads, then slide the shuttle across: it strums the lifted threads like a harp and lays a row of cloth. Each level shows a target pattern on a small card, and you work out which lever combinations weave it. When the cloth is finished, it plays itself back as a melody.

**Play:** https://or-6.github.io/loomsong/ (open it in the headset's browser with hand tracking on). Milestone snapshots stay at `/m0/`, `/m1/`, `/m2/` and `/m3/`.

> **Status:** M4, in progress. Everything below has been verified in the IWSDK emulator (IWER) only. **It has not yet been run on a headset.** On-device testing is scheduled before submission.

## The idea: your desk is the haptics

Hand tracking has no touch. Loomsong puts every interaction on a real surface:
- levers slide away from you along the desk;
- the shuttle slides left and right across it;
- your hand rests on something solid while it plays.

That means real contact, no mid-air reaching, no arm fatigue, and none of the depth guessing that makes mid-air pinching hard. Passthrough is the point, not decoration: the loom is sized to and placed on your actual table.

## Judge instructions

1. Open https://or-6.github.io/loomsong/ in the headset's browser (Quest 3 or 3S). Turn hand tracking on and put the controllers down.
2. Sit at a desk with decent light. Press **Enter XR**.
3. **Rest one hand flat on the desk for a second.** The loom unfolds there. (If no hand is seen, it appears at a default height after 8 s; poke the yellow arrows to raise or lower it.)
4. Follow the hints: slide the glowing lever away from you, then slide the shuttle across. Your first row plays within a minute.
5. Pinch-and-slide or just poke. Poking a lever toggles it, poking the shuttle throws it, and poking or pulling the bobbin unpicks the last row.
6. There's nothing to log into. Progress stays in the browser. Finish levels 1–3 to unlock the Workshop style.

## How each hard requirement is met

| # | Requirement | How Loomsong meets it | Evidence |
|---|---|---|---|
| R1 | Fully usable with hands | No controller path anywhere. Placement, levers, shuttle, undo, style switch and nudge arrows all take pinch **or** poke. | Emulator E2E suites drive everything with emulated hands only (`npm run test:e2e`) |
| R2 | Seated, two-foot test | Every interactable sits within 60 cm of the seated head at the default desk height | `npm run check:reach` (worst case 59.3 cm) |
| R3 | Easy in and out, clean pause | No login, no tutorial wall. Progress is saved. Play pauses on session blur and page hide, and audio suspends with it. | `src/app/game-system.ts`; blur pause is unit-level only (the emulator can't force blur) |
| R4 | Satisfying in ≤ 10 minutes | The first row plays in under a minute. Levels are 4–12 rows (authored 4–6; generated grow slowly). | Level 1 E2E; real stopwatch timing on device is pending |
| R5 | Original, not a wrapper | Game, geometry, textures and audio are all generated in this repo. Libraries are listed below. | Source, licences |
| R6 | Free | No ads, IAP or paywalls | `npm run check:rules` |
| R7 | No logos or people | Abstract loom; no brand names in the app | `npm run check:rules` |
| R8 | HTTPS link, no login | Static build on GitHub Pages | https://or-6.github.io/loomsong/ |
| R9 | Available through the winner announcement | Hosted on GitHub Pages, kept live through Dec 31 | — |
| R10 | No edits after the deadline | Tag `submitted`; no deploys after the deadline | — |
| R11 | Video < 3 min | Real capture, no AI-generated video | Pending |

## Features

- **Set the table.** A flat, still palm places the loom. It snaps to a detected table plane only if your palm is over that plane, and the desk must sit 25–85 cm below your eyes. Fallbacks: a default height with nudge arrows. The loom gets an optional spatial anchor.
- **Interaction.**
  - Pinch-slide uses our own hysteresis on raw joint data (engage at 2.0 cm, release at 3.5 cm), One-Euro smoothing, magnetic detents, "past 60% completes the throw", and tracking loss over 150 ms counts as a release.
  - Poke works on every control.
  - Hand occluders let threads pass behind your real fingers.
- **Puzzles.** Levels 1–3 are hand-authored; level 4 onwards is generated from a seed, is solvable by construction, and is scored against a computed par. Stars, a star-total nameplate and endless play.
- **Sound.** Everything is synthesised with Web Audio: plucked threads on a pentatonic scale that changes per level, lever clicks, the beat thud and a completion arpeggio. Every sound has a visual twin: warps twang, the cloth glows and the stars light up.
- **Sharing.** A finished cloth becomes a `#w=` link. Opening it starts a "weave this" challenge.
- **Styles.** "Toy loom" is the default; "Workshop" unlocks after levels 1–3.
- **Play together (beta).** Two people at two desks share one loom. The host works the levers and the guest throws the shuttle; both see and hear the same cloth. Open "Play together" on the 2D page: one player hosts and reads out a 4-letter code, the other joins with it, and both enter XR. Co-op is never part of the first-run flow.

## Accessibility

- **Input:** pinch or poke on every control; one hand is enough; either hand works; the lever bank follows your hand or can be set left or right.
- **Fit to my hands** (on the 2D page): three pinches and a 2 s hold tune pinch thresholds, smoothing and target size (1.0–1.8×).
- **High contrast:** pure white/black yarn, a black-and-white card and opaque labels. Pattern status never relies on hue: ticks, crosses, arrows and hatching carry it.
- **No timers, no fail states, undo always available.**
- In-world text has a cap height of at least 1.5 cm, with at most 5 words per label.

**Honest caveat:** these features have **not** been validated with disabled players. Calibration's tremor handling is unit-tested with synthetic jitter only, because the emulator's hand is perfectly steady. Feedback is very welcome.

## Privacy

There are no accounts, no analytics and no voice. Progress and settings stay in your browser's local storage.

Co-op is the only feature that uses the network, and only after you open it. It connects the two players directly over WebRTC, using PeerJS's public signalling server (`0.peerjs.com`), a public STUN server and PeerJS's TURN relay if a direct link fails. As with any peer-to-peer connection, each player's IP address is visible to the other player and to those servers. Only game state is sent: lever states, shuttle position and rows.

## Run and build

```bash
npm install
npm run dev          # IWSDK-managed dev server + emulator (https://localhost:8081)
npm test             # unit tests (vitest)
npm run check:reach  # R2 reach check
npm run check:rules  # brands, audio files, network, monetisation, tagline
npm run test:e2e     # emulator E2E (needs: npx @iwsdk/cli dev up --ai-mode agent --headless --allow-browser-automation)
npm run test:e2e:coop  # two-tab co-op E2E over the real PeerJS broker (needs internet)
npm run build        # static build in dist/
```

Dev URL parameters:

| Parameter | Effect |
|---|---|
| `?desk=<y>` | Fixes the desk height (metres) |
| `?noise=1` | Adds 3 mm jitter and 2% dropouts to hand tracking |
| `?degrade=1` or `?degrade=2` | Forces a frame-guard quality level |
| `?probe` | Dev builds only: publishes raw joint data |
| `#w=<code>` | Opens a shared cloth |

Docs: `docs/IWSDK-NOTES.md` (platform findings, with evidence) and `docs/ART-DIRECTION.md`.

## Libraries and licences

| Package | Use | Licence |
|---|---|---|
| `@iwsdk/core` 1.0.1 and its `@iwsdk/*` runtime packages | WebXR runtime, ECS, input, scene understanding | MIT |
| `three` (as `super-three` 0.181) | Rendering | MIT |
| `elics`, `@preact/signals-core`, `zod`, `three-mesh-bvh`, `yoga-layout` | Pulled in by IWSDK | MIT |
| `@pmndrs/uikit`, `uikit-horizon`, `uikit-lucide`, `handle` | Pulled in by IWSDK's UI layer (Loomsong renders no UIKit panels and ships only 2 icons) | MIT |
| `@drawcall/uikitml` | Pulled in by IWSDK's UI layer | **No licence declared in its package**; it ships as part of Meta's IWSDK distribution |
| `peerjs` 1.5.5 | Opt-in co-op (WebRTC), loaded on demand only | MIT |
| Lilita One (Juan Montoreano) | Toy-style display font | SIL OFL 1.1 (`public/fonts/LilitaOne-OFL.txt`) |
| Fraunces 72pt Soft SemiBold (The Fraunces Project Authors) | Workshop-style font, loaded on demand | SIL OFL 1.1 (`public/fonts/Fraunces-OFL.txt`) |

Dev only (not shipped): `@iwsdk/cli`, `@iwsdk/vite-plugin-dev`, `@iwsdk/reference`, `@meta-quest/metavr`, `vite`, `vitest`, `typescript`.

## Known limits

- **Not yet run on a headset.** Hand-tracking feel, audio latency, real frame rate, placement accuracy on real desks and persistent-anchor behaviour in Quest Browser are all unverified.
- The headless emulator runs at about 60 fps against a 72 Hz target, so the frame guard degrades there by design. Real-device timing is unknown.
- If controllers are connected, IWSDK may fetch controller models from `cdn.jsdelivr.net` (a library default). Hands-only play makes no external requests.
- **Co-op is a beta.** It has been tested between two tabs of the emulator over the real PeerJS broker, never between two headsets. It depends on PeerJS's free public servers, which can be busy or unavailable; if they are, the 2D page says so and solo play is unaffected.
- Bundle: about 0.95 MB gzip in total; the main chunk is 632 kB. Co-op adds a 24 kB chunk, loaded only when used.
