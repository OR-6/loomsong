# Loomsong

A hands-only mixed-reality puzzle game for Meta Quest, built with the Immersive Web SDK (IWSDK 1.0.1, WebXR). It runs in the headset's browser: no install, no account.

A little wooden toy loom unfolds on your real desk. Each level shows a small pixel picture on a card. Slide levers away from you to lift threads, then pinch Pip, a yarn-ball bird, and slide him across: he strums the lifted threads like a harp and lays one row of the picture. Work out which levers make each row. Finish the picture and it pops out of the cloth as a plush that dances, sings its picture, and goes to live on your shelf, or anywhere on your real desk.

**Play:** https://or-6.github.io/loomsong/ (open it in the headset's browser with hand tracking on).

> **Status:** verified in the IWSDK emulator (IWER) with emulated hands. **It has not yet been run on a headset.** On-device testing is scheduled before submission.

## The idea: your desk is the controller, the shelf and the save file

Hand tracking has no touch, so Loomsong puts every interaction on a real surface. Levers slide along the desk, Pip slides across it, and your hand rests on something solid while you play: real contact, no reaching into the air. The game only works because it uses your real table: the loom stands on it, your plushes stay where you put them on it, and next time the loom comes back to the same spot in your room.

## Judge instructions

1. Open https://or-6.github.io/loomsong/ in the headset's browser (Quest 3 or 3S). Turn hand tracking on and put the controllers down (if you're still holding them, the game asks you to).
2. Sit at a table with decent light. Press **Enter mixed reality**.
3. **Rest one hand flat on the table for a second.** The loom unfolds there. (No hand seen? It appears at a default height after a few seconds; poke the yellow arrows to raise or lower it.)
4. Follow the ghost hand: slide the glowing lever away from you, then pinch Pip and slide him across. Your first row plays within a minute.
5. Pinch-and-slide, or just poke: poking works on every control.
6. Nothing to log into. Progress stays in the browser.
7. **Short on time?** Add `?start=friends` to the link to start at the fourth picture, where your plushes become tools (poke a plush to seat it on the cushion). `?finale=1` shows the ending.
8. **Phone caller:** on the 2D page open "Play together" and press Host (a toy telephone appears on your desk with the code), then enter the code on any phone at the same link.

## What's in it

- **A quiet start.** The first picture shows only the loom, the card, Pip and two levers. The desk fills as you play: the shelf springs up with your first plush, the chapter basket after two pictures, the present of the day after three, the toy telephone once Garden is woven. The tutorial lets you find the two-lever trick yourself before it shows you. On the second picture the ghost hand shows, once and without words, that a plush can be lifted off the shelf onto your desk.
- **Hear before you weave.** Poke a row of the picture card and it plays that row's tune; a right row sounds the same when you weave it.
- **18 hand-made pictures in four chapters.** Garden teaches that levers add up (the first picture already needs two levers at once). Home is mostly combinations. In Night, a lever's threads stay hidden until you try it (the first try of each is free). In Sea, rows of water need a second colour of yarn that you swap mid-picture. Every level has its own lever set; knots above the card count your moves, and the fewest moves earn three stars and a gold felt bow on that plush. Every chapter opens once the first picture is woven, so even a short visit reaches Night and the Sea.
- **Your plushes help.** Some pictures need a friend: set a plush from your shelf or desk on the felt cushion in front of the loom and it lifts the threads under its feet (its picture's bottom row). Which friend, and when to lift it off again, is part of the puzzle. The Table (Garden), the Lantern (Night) and the Jellyfish (Sea) each need a friend with the right feet; poke a plush to seat it or send it home, and felt strings show which threads it lifts.
- **Pictures come alive.** A picture's name stays a surprise (a "?" on the plate) until you finish it: it pops out as a stitched felt plush in its exact shape, its name on a felt ribbon above it, and dances on a little felt stage while its song plays, then hops onto the chapter shelf. Poke a plush and it sings its picture; turn the brass wind-up key and every plush plays in turn, like a music box. Finishing a chapter plays the whole shelf.
- **Plushes on your desk.** Pinch a plush, carry it off the shelf and set it down anywhere on the table; set it beside another and they say hello. It stays there between sessions. When the table is a detected surface, a plush only stays over it (drop it off the edge and it hops back). The wind-up key plays your plushes left to right as they stand, so arranging the desk rearranges the tune.
- **Quilts on your wall.** Finish a chapter and its pictures, sewn into a little quilt, fly off the shelf and hang on the real wall straight ahead of your seat (found from the room's vertical planes; sized to read from the seat). They're there every session after, so your wall fills up as you play. Look at a quilt for a moment and that chapter's pictures play again, from the wall. No wall in the room data: no quilt is hung (nothing floats in the air).
- **The room changes with the chapter.** At Night your real room dims to dusk around the loom; by the Sea, pool-light ripples drift across your real table.
- **Pip likes you.** Look at Pip for a moment and it waves; stroke it with a flat hand and it closes its eyes and trills.
- **Welcome back.** After a few hours away, Pip is asleep on its perch (felt Zs drift up) and wakes with a stretch when your hand reaches in.
- **The room remembers.** Once the loom is held by IWSDK's persistent spatial anchor, its pose is saved. Next session, if the same anchor comes back and the spot is still within seated reach, the loom unfolds right where you left it. "Move the loom" in the settings sets a new spot.
- **A picture of the day.** A wrapped present, somewhere new on your desk each day, holds today's picture (21 of them, the same for everyone that day). Weave it and its plush hops onto your desk; days in a row are counted, and the opened box shows tomorrow's picture as a silhouette.
- **Music.** Every thread is a recorded kalimba note on a pentatonic scale. Run a fingertip over the threads to play them like a harp. Each thread sounds from its own place across the loom, and a plush sings from where it stands. Each chapter has its own piece by Scott Buckley (soft piano, strings, accordion), played quietly under the threads; the threads, every row and every plush's song are tuned to that piece's key, so the game always plays in harmony with the music.
- **An ending.** When the last chapter is done, the loom weaves a heart by itself (the levers and Pip move on their own, each row singing), then every chapter's shelf springs up in turn and sings while the credits go by on a felt ribbon. Play then carries on with endless bonus patterns. Add `?finale=1` to the URL to see it straight away.
- **Play together.** Poke the toy telephone on your desk once Garden is woven (or press Host on the 2D page at any time) and read out the four-letter code on its tag (the headset also shows the page's address for your friend; a `?join=CODE` link fills the code in). A friend can join from **any phone** as your caller. Only the caller sees the picture, and only the weaver sees which threads each lever lifts, so you have to talk it through. The caller taps a square to drop a felt pin on that thread in the headset, hears each row as it's woven, can ring Pip to wave hello, and keeps a postcard of every picture you finish together. (The code for two headsets sharing one loom is still in the repo, but it's not offered in the UI: it has never been tested on two devices.)
- **Sharing.** A finished cloth becomes a `#w=` link; opening it starts a "weave this" challenge.
- **Styles.** "Toy loom" is the default; "Workshop" unlocks after the Garden chapter.

## Accessibility

- **Input:** pinch or poke on every control; one hand is enough; either hand works; the lever bank follows your hand or can be set left or right.
- **Levers by count, not just colour:** the lever box marks each slot with 1–4 inlaid dots (and red, teal, mustard and plum also differ in lightness), so colour-blind players and Night's undyed mystery levers never depend on hue.
- **Fit to my hands** (on the 2D page): three pinches and a 2 s hold tune pinch thresholds, smoothing and target size (1.0–1.8×).
- **High contrast:** pure white/black yarn, a black-and-white card and opaque labels. Row status never relies on hue: ticks, crosses, arrows and hatching carry it.
- **No timers, no fail states, undo always available** (after the first picture a wrong row unweaves itself once Pip has drooped). Hints name levers by number and colour ("Lift lever 1 (red)"), matching the dots on the lever box.
- In-world text has a cap height of at least 1.5 cm, with at most 5 words per label.
- **Look to play** (on the 2D page): no hands needed at all. Look at a lever, Pip, the undo spool or the yarn swap for about a second and it is pressed; a small felt dot grows on it while you look, and each look presses once. The loom already places itself at a default height if no hand is seen.
- **Calm motion** (on the 2D page; on by default when your system asks for reduced motion): far less confetti, small hops and bounces, and the Sea's light on the table barely drifts.
- **Reach:** measured in the emulator from a seated player's shoulders, the levers are 41–49 cm away, Pip 49 cm, the undo spool 42 cm; the loom unfolds where your hand rests, so it starts within reach.
- Every sound has a visual twin: a plucked thread twangs, a woven row gets a tick or a cross on the card, Pip cheers or droops.

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
| Scott Buckley: 'Castles in the Sky', 'Home Was You', 'Sleep', 'Solace' (scottbuckley.com.au) | The chapters' music, in `public/audio/music/` | CC BY 4.0 (credited in `public/audio/CREDITS.md` and on the page) |
| Kenney Music Jingles (pizzicato) | Win and chapter-complete flourishes | CC0 1.0 |
| ambientCG Wood095, Fabric019 | Beech grain and knit yarn textures, baked into `public/models/loom.glb` | CC0 1.0 (ambientcg.com) |

Dev only (not shipped): `@iwsdk/cli`, `@iwsdk/vite-plugin-dev`, `@iwsdk/reference`, `@meta-quest/metavr`, `vite`, `vitest`, `typescript`.

## Known limits

- **Not yet run on a headset.** Hand-tracking feel, audio latency, real frame rate, placement accuracy on real desks and persistent-anchor restore in the headset's browser are all unverified (the emulator restores anchors from local storage).
- The headless emulator runs at about 60 fps against a 72 Hz target, so the frame guard degrades there by design. Real-device timing is unknown.
- If controllers are connected, IWSDK may fetch controller models from `cdn.jsdelivr.net` (a library default). Hands-only play makes no external requests.
- **Co-op is a beta.** It has been tested between emulator tabs (headset and phone caller) over the real PeerJS broker, never between two real devices. It depends on PeerJS's free public servers, which can be busy or unavailable; if they are, the 2D page says so and solo play is unaffected.
- Co-op and the phone caller load their code only when used.
