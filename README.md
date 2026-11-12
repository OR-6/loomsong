# Loomsong

A mixed-reality puzzle game for Meta Quest, made for your hands (controllers work too), built with the Immersive Web SDK (IWSDK 1.0.1, WebXR). It runs in the headset's browser: no install, no account.

A little wooden toy loom unfolds on your real desk. Each level shows a small pixel picture on a card. Slide levers away from you to lift threads, then pinch Pip, a yarn-ball bird, and slide him across: he strums the lifted threads like a harp and lays one row of the picture. Work out which levers make each row. Finish the picture and it pops out of the cloth as a plush that dances, sings its picture, and goes to live on your shelf, or anywhere on your real desk.

**Play:** https://or-6.github.io/loomsong/ (open it in the headset's browser with hand tracking on).

> **Status:** verified in the IWSDK emulator (IWER) with emulated hands; a playtester has played it on a Quest 3.

## The idea: your desk is the controller, the shelf and the save file

Hand tracking gives no touch feedback, so Loomsong puts every interaction on a real surface. Levers slide along the desk, Pip slides across it, and your hand rests on something solid while you play. Everything happens on your real table: the loom stands on it, and your plushes stay where you put them.

## Judge instructions

1. Open https://or-6.github.io/loomsong/ in the headset's browser (Quest 3 or 3S). Hand tracking is the way it's meant to be played; if you'd rather hold controllers, they work too (the trigger pinches, the controller's tip pokes; rest it on the table and hold the trigger to set the loom down).
2. Sit at a table with decent light. Press **Enter mixed reality**.
3. **Rest one hand flat on the table for a second.** The loom unfolds there, and the first time, tags name its parts: the card, the levers and Pip. (No hand seen? After about 8 seconds, or 15 if your hands are up but not flat, it appears at a default height; poke the yellow arrows to raise or lower it.)
4. Follow the ghost hand: slide the glowing lever away from you, then pinch Pip and slide him across. Your first row plays within a minute.
5. Pinch-and-slide, or just poke: poking works on every control.
6. Settings without leaving the headset: poke the felt **Settings** tag at the loom's front corner for calm motion, high contrast, rows by ear, Look to play, Rest to press, music, which side the levers stand on, and Fit to my hands.
7. Nothing to log into. Progress stays in the browser.
8. **Short on time?** Add `?start=friends` to the link to start at the fourth picture, where your plushes become tools (poke a plush to seat it on the cushion). `?start=night` and `?start=sea` jump to those chapters; `?finale=1` shows the ending.
9. **Phone caller:** with `?start=friends` the toy telephone is on your desk at once (in normal play it arrives a few pictures into Home). Poke it twice; its tag shows a four-letter code. On any phone, open the same link, type the code in the box at the top and press **Join as caller**. Alone? Wait 20 seconds and a practice caller picks up: the picture leaves the loom and felt pins drop on each row's threads. Poke the telephone to hang up.

## What's in it

- **A quiet start.** The first picture shows only the loom, the card, Pip and two levers. The desk fills as you play: the shelf springs up with your first plush, the chapter basket once Garden is woven, the present of the day two pictures into Home, the toy telephone after that. Each picture brings at most one new thing. The tutorial lets you find the two-lever trick yourself before it shows you. When visitors begin, the ghost hand shows, once and without words, that a plush can be lifted off the shelf onto your desk.
- **Hear before you weave.** Poke a row of the picture card and it plays that row's tune; a right row sounds the same when you weave it.
- **18 hand-made pictures in four chapters, plus 26 pictures of the day.** Garden teaches that levers add up (the first picture already needs two levers at once). Home is mostly combinations. In Night, a lever's threads stay hidden until you try it (the first try of each is free, and so is putting it straight back); the Moon hides two levers, the Ghost three, then all of them. The Sea hides its levers too, its rows of water need a second colour of yarn that you swap mid-picture, and its tide covers the card: you see two rows at a time, so the picture is a surprise until it's woven. Night and the Sea need levers together on about three rows in four, and each has a picture that arrives tangled: woven part-way with one wrong row to find, unpick back to with the spool, and weave on from. Every level has its own lever set. From Home on, yarn bows above the card count your lever moves (each move unties one), and the fewest moves earn three stars and a gold felt bow on that plush. Once Garden is woven, the yarn basket lets you pick any chapter; short on time, `?start=night` or `?start=sea` jumps straight there.
- **Your plushes are a toolkit.** Once Night is woven, the cushion stays out for every picture: seat any plush and it lifts the threads under its feet with no lever move, so the right plush at the right row saves moves (and earns gold).
- **Your plushes help.** Some pictures need a friend: set a plush from your shelf or desk on the felt cushion in front of the loom and it lifts the threads under its feet (its picture's bottom row). Which friend, and when to lift it off again, is part of the puzzle. The Flower table (Garden), the Lantern (Night) and the Jellyfish (Sea) each need a friend with the right feet; poke a plush to seat it or send it home, and felt strings show which threads it lifts.
- **Pictures come alive.** A picture's name stays a surprise (the plate just says "new picture") until you finish it: it pops out as a stitched felt plush in its exact shape, its name on a felt ribbon above it, and dances on a little felt stage while its song plays, then hops onto the chapter shelf. Poke a plush and it sings its picture; poke the brass wind-up key and every plush plays in turn, like a music box. Finishing a chapter plays the whole shelf.
- **Plushes on your desk.** Pinch a plush, carry it off the shelf and set it down anywhere on the table; set it beside another and they say hello. It stays there between sessions. When the table is a detected surface, a plush only stays over it (drop it off the edge and it hops back). The wind-up key plays your plushes left to right as they stand, so arranging the desk rearranges the tune.
- **Quilts on your wall.** Finish a chapter and its pictures, sewn into a little quilt, fly off the shelf and hang on the real wall straight ahead of your seat (found from the room's vertical planes; sized to read from the seat). They're there every session after, so your wall fills up as you play. Look at a quilt for a moment and that chapter's pictures play again, from the wall. No wall in the room data: no quilt is hung (nothing floats in the air).
- **The room changes with the chapter.** At Night your real room dims to dusk around the loom; by the Sea, pool-light ripples drift across your real table.
- **Pip likes you.** Look at Pip for a moment and he waves; stroke him with a flat hand and he closes his eyes and trills.
- **Welcome back.** After a few hours away, Pip is asleep on his perch (felt Zs drift up) and wakes with a stretch when your hand reaches in.
- **The room remembers.** Built on IWSDK's persistent spatial anchors (restore so far verified in the emulator): once the loom is anchored, its pose is saved. Next session, if the same anchor comes back and the spot is still within seated reach, the loom unfolds right where you left it. "Move the loom" in the settings sets a new spot. In the headset, poke the loom's name plate twice: it folds away and unfolds in front of you wherever you rest your hand next (the picture is kept).
- **Visitors (a picture of the day).** Each picture of the day likes one chapter plush. Leave that plush out on your real desk and its visitor brings the present (today, if today's is still wrapped; otherwise tomorrow): the wrapped present appears right beside it ("Someone came to see your Sprout"), and once woven the visitor plush stays there by its friend. Chosen once a day and saved; with no plush out, the present holds the day's own picture. Its kind turns over four days: plain, tangled, hidden levers, the tide (each once you've met it in a chapter). The opened present keeps a tally of the days you've woven one (never a streak to lose). No streaks. `?visit=1` makes one arrive now.
- **Rows by ear.** In Home (from its second picture) and the pictures of the day, one row per picture is a felt patch with a note on the card: Pip hums it (each thread plucks from its place), and you find the levers that sound the same. A first miss: he hums it again with the threads quivering (a hint you can see). A second: the patch peels off and the card marks the squares.
- **Same row again.** When the next row repeats the last and the levers already make it, Pip says so and flies back by himself.
- **On the beat.** A right row thrown on the music's beat sparkles gold, and from Home on it ties a spent bow back on.
- **Your pace.** Once a plush has popped out, a pinch anywhere skips the rest of its song and dance. Poke a shelf plush twice while it sings to weave that picture again.
- **Music.** Every thread is a recorded kalimba note on a pentatonic scale. Run a fingertip over the threads to play them like a harp. Each thread sounds from its own place across the loom, and a plush sings from where it stands. Each chapter has its own piece by Scott Buckley (soft piano, strings, accordion), played quietly under the threads; the threads, every row and every plush's song are tuned to that piece's key, so the game always plays in harmony with the music.
- **An ending.** When the last chapter is done, the loom weaves a heart by itself (the levers and Pip move on their own, each row singing), then every chapter's shelf springs up in turn and sings while the credits go by on a felt ribbon. Play then carries on with any picture still to weave, then the pictures again, each with a twist (tangled, the tide, or hidden levers), for gold bows. Add `?finale=1` to the URL to see it straight away.
- **Play together.** Poke the toy telephone on your desk (it arrives a few pictures into Home, or at once with `?start=friends`) twice and read out the four-letter code on its tag (the headset also shows the page's address for your friend; a `?join=CODE` link fills the code in). A friend can join from **any phone** as your caller. Only the caller sees the picture, and only the weaver sees which threads each lever lifts, so you have to talk it through. The caller taps up to two squares a row to drop felt pins on those threads in the headset (the rest has to be said), hears each row as it's woven, can ring Pip to wave hello, and keeps a postcard of every picture you finish together. If nobody joins within 20 seconds (or the line is busy), a practice caller picks up and pins each row's threads, so you can try it alone; a friend joining takes over. (The code for two headsets sharing one loom is still in the repo, but it's not offered in the UI: it has never been tested on two devices.)
- **Sharing.** On the 2D page, "Share this cloth" turns your last cloth into a `#w=` link; opening it starts a "weave this" challenge.
- **Styles.** "Toy loom" is the default; "Workshop" unlocks once Home is woven.

## Accessibility

- **Input:** pinch or poke on every control; **Rest to press** (off by default; a switch on the 2D page and by the loom): a fingertip held still in a control for 0.9 s presses it, no speed or pointing needed. Fit to my hands turns it on for you if your pinch doesn't close fully or your hand trembles; one hand is enough; either hand works; controllers work too (trigger to pinch); the lever bank follows your hand or can be set left or right.
- **Levers by count, not just colour:** the lever box marks each slot with 1–4 inlaid dots so colour-blind players and Night's undyed mystery levers never depend on hue.
- **Fit to my hands** (on the 2D page): three pinches (anything under 4.5 cm counts) and a 2 s hold (a brief tremor doesn't restart it) tune pinch thresholds, smoothing and target size (1.0–1.8×).
- **High contrast:** the cloth weaves black on white (the second yarn grey), a black-and-white card and opaque labels. Row status never relies on hue: ticks, crosses, rings and arrows carry it.
- **No time limits on any puzzle, no fail states, undo always available** (a wrong row unweaves itself once Pip has drooped). Hints name levers by number and colour ("Push lever 1 (red) away"), matching the dots on the lever box.
- Hint tags use large lettering (about 1.5 cm on the main tags) and short phrases.
- **Look to play** (on the 2D page, or the Settings tag by the loom): no hands needed. Look at any control for about a second and it is pressed: levers, Pip, the undo spool, the yarn, the card's rows, the present, the telephone, the basket, the plate (move the loom), the height arrows, the wind-up key, the Settings tags, plushes. A ring of dark felt beads fills while you look; a lever's threads light up while you look at it, so finding out costs nothing; the look aims a little below head-forward, so you lower your eyes rather than your neck. With Look to play, looking at a shelf plush twice sets it out on the desk (moving it to a spot of your choice still needs a hand). The loom already places itself at a default height if no hand is seen.
- **Calm motion** (on the 2D page or the Settings tag; on by default when your system asks for reduced motion): far less confetti, small hops and bounces, a gentle dance, a lighter Night, the Sea's light barely drifts, and a finished quilt simply appears on the wall.
- **Reach:** measured in the emulator from a seated player's shoulders, the levers are 41–49 cm away, Pip 49 cm, the undo spool 42 cm; the loom unfolds where your hand rests, so it starts within reach.
- **Rows by ear** (on by default; a switch on the 2D page or the Settings tag): one row per picture in Home is hummed instead of shown. Miss it once and Pip hums it again with the threads quivering, so you can watch it; switch it off and every row shows. Every other sound has something to see: a plucked thread twangs, a woven row gets a tick or a cross on the card, Pip cheers or droops.

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
| `?start=friends`, `?start=night`, `?start=sea` | Starts at the first friend picture, Night or the Sea, with the pictures before it woven |
| `?finale=1` | Shows the ending |
| `?visit=1` | A visitor arrives now |
| `?join=<CODE>` | Fills in a caller's code |
| `?sleep=1` | Pip is napping, as after a few hours away |

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

- **Headset testing is early.** A playtester has played it on a Quest 3, and that session shaped the tour, the hints and the hand visuals. Audio latency, frame rate over a long session, placement on many kinds of desk and persistent-anchor restore have not been measured on a headset (the emulator restores anchors from local storage).
- The headless emulator runs at about 60 fps against a 72 Hz target, so the frame guard degrades there by design. Real-device timing has not been measured.
- If controllers are connected, IWSDK may fetch controller models from `cdn.jsdelivr.net` (a library default). Hands-only play makes no external requests.
- **Co-op is a beta.** It has been tested between emulator tabs (headset and phone caller) over the real PeerJS broker, never between two real devices. It depends on PeerJS's free public servers, which can be busy or unavailable; if they are, the 2D page says so and solo play is unaffected.
- Co-op and the phone caller load their code only when used.
