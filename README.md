# Loomsong

A hands-only mixed-reality puzzle game for Meta Quest, built with the Immersive Web SDK (IWSDK 1.0.1, WebXR). It runs in the headset's browser: no install, no account.

A little wooden toy loom unfolds on your real desk. Each level shows a small pixel picture on a card. Slide levers away from you to lift threads, then pinch Pip, a yarn-ball bird, and slide him across: he strums the lifted threads like a harp and lays one row of the picture. Work out which levers make each row. Finish the picture and it pops out of the cloth as a plush that dances, sings its picture, and goes to live on your shelf, or anywhere on your real desk.

**Play:** https://or-6.github.io/loomsong/ (open it in the headset's browser with hand tracking on).

> **Status:** verified in the IWSDK emulator (IWER) with emulated hands. **It has not yet been run on a headset.** On-device testing is scheduled before submission.

## The idea: your desk is the controller, the shelf and the save file

Hand tracking has no touch, so Loomsong puts every interaction on a real surface. Levers slide along the desk, Pip slides across it, and your hand rests on something solid while you play: real contact, no reaching into the air. The game only works because it uses your real table: the loom stands on it, your plushes stay where you put them on it, and next time the loom comes back to the same spot in your room.

## Judge instructions

1. Open https://or-6.github.io/loomsong/ in the headset's browser (Quest 3 or 3S). Turn hand tracking on and put the controllers down.
2. Sit at a table with decent light. Press **Enter mixed reality**.
3. **Rest one hand flat on the table for a second.** The loom unfolds there. (No hand seen? It appears at a default height after a few seconds; poke the yellow arrows to raise or lower it.)
4. Follow the ghost hand: slide the glowing lever away from you, then pinch Pip and slide him across. Your first row plays within a minute.
5. Pinch-and-slide, or just poke: poking works on every control.
6. Nothing to log into. Progress stays in the browser.

## What's in it

- **A quiet start.** The first picture shows only the loom, the card, Pip and two levers; the shelf springs up when your first plush is born, the basket and the daily present come after. The tutorial lets you find the two-lever trick yourself before it shows you.
- **15 hand-made pictures in four chapters.** Garden teaches that levers add up (the first picture already needs two levers at once). Home is mostly combinations. In Night, a lever's threads stay hidden until you try it (the first try of each is free). In Sea, rows of water need a second colour of yarn that you swap mid-picture. Every level has its own lever set; knots above the card count your moves, and the fewest moves earn three stars.
- **Pictures come alive.** A finished picture pops out as a plush made from the woven cells, dances on a little felt stage while its song plays, then hops onto the chapter shelf. Poke a plush and it sings its picture; turn the brass wind-up key and every plush plays in turn, like a music box. Finishing a chapter plays the whole shelf.
- **Plushes on your desk.** Pinch a plush, carry it off the shelf and set it down anywhere on the table. It stays there between sessions. When the table is a detected surface, a plush only stays over it (drop it off the edge and it hops back). The wind-up key plays your plushes left to right as they stand, so arranging the desk rearranges the tune.
- **Quilts on your wall.** Finish a chapter and its pictures, sewn into a little quilt, fly off the shelf and hang on the real wall straight ahead of your seat (found from the room's vertical planes; sized to read from the seat). They're there every session after, so your wall fills up as you play. No wall in the room data: no quilt is hung (nothing floats in the air).
- **The room remembers.** Once the loom is held by IWSDK's persistent spatial anchor, its pose is saved. Next session, if the same anchor comes back and the spot is still within seated reach, the loom unfolds right where you left it. "Move the loom" in the settings sets a new spot.
- **A picture of the day.** A wrapped present beside the basket holds today's picture (21 of them, the same for everyone that day). Weave it and its plush hops onto your desk; days in a row are counted, and the opened box shows tomorrow's picture as a silhouette.
- **Music.** Every thread is a recorded kalimba note on a pentatonic scale. Run a fingertip over the threads to play them like a harp. A small generative music box plays underneath, with a melody for each chapter; rows thrown on the beat earn a gold shower.
- **Play together.** Host a loom and read out the four-letter code. A friend can join from **any phone** as your caller: only the caller sees the picture, so you have to talk it through. Two headsets can also share one loom (one works the levers, the other throws the shuttle).
- **Sharing.** A finished cloth becomes a `#w=` link; opening it starts a "weave this" challenge.
- **Styles.** "Toy loom" is the default; "Workshop" unlocks after the Garden chapter.

## Accessibility

- **Input:** pinch or poke on every control; one hand is enough; either hand works; the lever bank follows your hand or can be set left or right.
- **Levers by count, not just colour:** the lever box marks each slot with 1–4 inlaid dots (and red, teal, mustard and plum also differ in lightness), so colour-blind players and Night's undyed mystery levers never depend on hue.
- **Fit to my hands** (on the 2D page): three pinches and a 2 s hold tune pinch thresholds, smoothing and target size (1.0–1.8×).
- **High contrast:** pure white/black yarn, a black-and-white card and opaque labels. Row status never relies on hue: ticks, crosses, arrows and hatching carry it.
- **No timers, no fail states, undo always available.** Levers are named by colour in the hints ("Lift the red lever").
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
npm run e2e          # every emulator E2E suite (needs: npx @iwsdk/cli dev up --ai-mode agent --headless --allow-browser-automation)
npm run test:e2e:coop  # two-tab co-op E2E over the real PeerJS broker (needs internet)
npm run build        # static build in dist/
```

Dev URL parameters:

| Parameter | Effect |
|---|---|
| `?desk=<y>` | Fixes the desk height (metres) |
| `?noise=1` | Adds 3 mm jitter and 2% dropouts to hand tracking |
| `?degrade=1` or `?degrade=2` | Forces a frame-guard quality level |
| `?debug=1` | Shows frame rate, draw calls and quality level on a tag behind the card (for headset testing) |
| `?shadows=0` | Turns off real-time shadows (contact shadows stay), to compare frame times |
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
| VCSL Kalimba, VSCO 2 CE glockenspiel (Versilian Studios); Kenney Impact, RPG and Interface sounds; Freesound bird calls by alegemaate, ReadeOnly and nfrae (Pip's voice) | Recorded sound effects in `public/audio/` | CC0 1.0 (see `public/audio/CREDITS.md`) |
| ambientCG Wood095, Fabric019 | Beech grain and knit yarn textures, baked into `public/models/loom.glb` | CC0 1.0 (ambientcg.com) |

Dev only (not shipped): `@iwsdk/cli`, `@iwsdk/vite-plugin-dev`, `@iwsdk/reference`, `@meta-quest/metavr`, `vite`, `vitest`, `typescript`.

## Known limits

- **Not yet run on a headset.** Hand-tracking feel, audio latency, real frame rate, placement accuracy on real desks and persistent-anchor restore in the headset's browser are all unverified (the emulator restores anchors from local storage).
- The headless emulator runs at about 60 fps against a 72 Hz target, so the frame guard degrades there by design. Real-device timing is unknown.
- If controllers are connected, IWSDK may fetch controller models from `cdn.jsdelivr.net` (a library default). Hands-only play makes no external requests.
- **Co-op is a beta.** It has been tested between emulator tabs (headset and phone caller) over the real PeerJS broker, never between two real devices. It depends on PeerJS's free public servers, which can be busy or unavailable; if they are, the 2D page says so and solo play is unaffected.
- Co-op and the phone caller load their code only when used.
