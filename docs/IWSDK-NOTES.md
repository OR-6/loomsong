# IWSDK-NOTES.md — step zero findings

Date: 2026-11-09. Machine: macOS (Darwin 25.5), Node 22.23.1. **No Quest headset connected** (`adb` is not installed, so no device is reachable). Everything below comes from the IWSDK emulator (IWER) running inside the IWSDK-managed headless Chromium, or from reading IWSDK sources and typings. Nothing here is verified on a headset.

Evidence tooling: `src/probe.ts` (a temporary ECS system that publishes raw WebXR joint, plane and session data to `window.__probe`), read with `npx @iwsdk/cli browser run tools/probe-compact.mjs`.

## 0. Versions and scaffold

| Item | Finding | Evidence |
|---|---|---|
| IWSDK version | **1.0.1** (stable). npm `latest` currently points to `1.1.0-rc.2`, a release candidate, so the spec's "IWSDK 1.0" is pinned explicitly. | `npm view @iwsdk/core versions` / `dist-tags` |
| Scaffold | `npx @iwsdk/create@1.0.1 proj -y --target ar --language ts --grabbing --no-physics --scene-understanding --environment-raycast --no-install --no-git` | Output: "Starting point: Mixed reality / passthrough … SDK features: Grabbing, Room surfaces and anchors, Real-world placement" |
| Locomotion | `--no-locomotion` is **rejected for `--target ar`** ("not available for --target ar"). The AR template already writes `"locomotion": false`. | CLI error, then `iwsdk.config.json` |
| Project authority | `iwsdk.config.json` (not `vite.config.ts`) holds XR mode, features and emulator device. `src/index.ts` passes `virtual:iwsdk-project` to `World.create`. | scaffold `AGENTS.md`, `src/index.ts` |
| Three.js | `three` is aliased to `super-three@0.181.0`. Import Three from `@iwsdk/core`, not `three`. | `package.json` overrides, `AGENTS.md` |
| Agent tooling | The scaffold ships the `@iwsdk/cli` (MCP + CLI are one surface), project skills and rules. The emulator is driven through the **CLI**: `dev up`, `xr enter`, `xr set-input-mode`, `xr set-transform`, `xr set-select-value`, `browser run`. | `npx @iwsdk/cli --help`, `xr --help` |
| Dev server | `npx @iwsdk/cli dev up --ai-mode agent --headless --allow-browser-automation` → `https://localhost:8081/` (self-signed mkcert) plus a LAN URL. The first run installs Playwright Chromium (~40 s). | `dev status` |
| HMR gotcha | **Any source edit reloads the page and ends the emulated XR session.** Re-enter with `tools/xr-enter.sh`. | `set_transform` failed with "No active XR session" right after an edit |
| `hz-iwsdk-webxr` skill | Read from `meta-quest/agentic-tools` (`skills/hz-iwsdk-webxr`: SKILL.md + input-handling, ai-assisted-development). Key points: `World.create`, `launchXR/exitXR`; 72 Hz Quest Browser default; draw-call budget under ~100 on Quest 3; HTTPS required. | `gh api repos/meta-quest/agentic-tools/contents/skills/hz-iwsdk-webxr/...` |

## a. Hand joint poses per frame — how, and in which space

- IWSDK 1.0.1 has **no high-level joint API** for app code. It reads joints itself (`XRHandVisualAdapter` uses `frame.fillPoses(jointSpaces, gripSpace, …)`), and exposes only `player.indexTipSpaces.left/right` (an `Object3D` that follows the index tip, used by poke).
- **Use raw WebXR inside a system's `update()`:** `this.xrFrame.session.inputSources` → `src.hand.get('thumb-tip')` → `this.xrFrame.getJointPose(space, this.renderer.xr.getReferenceSpace())`. This returns position, orientation and `radius`.
- **Space:** the reference space is `local-floor` (enabled features include `local-floor`). `player` (the `XROrigin`) sits at world `(0,0,0)` with no locomotion, so **reference space = world space**. Evidence: `player.indexTipSpaces.right` world position `[0.2164, 1.5642, -0.4335]` equals the raw `index-finger-tip` joint pose `[0.2164, 1.5642, -0.4335]`. The head is at `[0, 1.6, 0]`, and `camera` world is `[0, 1.6, 0.0315]` (eye offset).
- **"Palm":** WebXR has no palm joint. Use `middle-finger-metacarpal` (palm centre). Its radius in the emulator is 0.0212 m.
- **Palm normal:** the wrist joint's **+Y axis is the back of the hand**, so palm-normal = −Y. Evidence: in the emulator's default pose (palm down), wrist +Y = `[0, 0.865, 0.502]` (mostly up, about 30° tilted back). Roll 180° flips it to `[0, -0.865, 0.502]`; roll ±90° makes it horizontal.
- Joint naming follows the WebXR Hand Input spec: `wrist`, `thumb-tip`, `index-finger-tip`, `index-finger-metacarpal`, `pinky-finger-metacarpal`, and so on.

## b. Pinch state and custom hysteresis

- IWSDK's own pinch: commit when the thumb-tip↔index-tip distance is **< 8 mm**, with a **0.2 s cooldown**. `getPinchStrength()` maps 50 mm→0 and 8 mm→1. The pinch is surfaced as the hand gamepad's select (`getSelectStart/End`). Source: `node_modules/@iwsdk/xr-input/dist/visual/adapter/hand-visual-adapter.js` (`pinchThreshold = 0.008`, `PINCH_OPEN_DISTANCE = 0.05`, `PINCH_COOLDOWN = 0.2`).
- **Own hysteresis:** compute the distance from the raw joint poses above every frame. Engage when `< 20 mm × calib`; release when `> 35 mm × calib`. Tracking loss longer than 150 ms is treated as a release. Fully decoupled from IWSDK's select.
- **Emulator behaviour (key for tests):** `xr set-select-value` on `hand-right` **moves the real thumb and index joints**. The mapping is linear: value 0 → 94.2 mm, 0.3 → 66.2 mm, 0.6 → 38.2 mm, 0.8 → 19.5 mm, 1.0 → 2.0 mm. So **engage needs value ≥ 0.8, and release needs value ≤ 0.55**. Our hysteresis is fully testable in E2E.

## c. `OneHandGrabbable` + `useHandPinchForGrab` vs a custom joint-driven system

**Decision: custom joint-driven constraint system. Grabbing is disabled.**

- `OneHandGrabbable` exposes `translateMin/translateMax` (Vec3) and `rotate:false`, so a box clamp is possible. But:
  - with `useHandPinchForGrab`, the grab start and end come from IWSDK's select (8 mm, 0.2 s cooldown; see `GrabSystem.update`, which routes `getSelectStart` → `routeDown('squeeze','grab')`). That breaks the spec's 20/35 mm hysteresis and calibration scaling;
  - the spec needs detents, a magnetic snap zone, "shuttle past 60% completes", a 150 ms tracking-loss rule, a grab radius of 2.5 cm × calibration multiplier, and slide speed driving strum timing. None of these are expressible in the grab component.
- A custom system is about 150 lines: pinch point = One-Euro-filtered thumb/index midpoint → project onto the constraint line → clamp. It also lets unit tests drive it with synthetic joint streams (spec §6). Poke is also custom (index-tip proximity to the lever head), so both modes share one input layer.

## d. Plane detection in the emulator; desk mock; labels

- **Testable: yes.** With `planeDetection: true`, `sceneUnderstanding: true` and the emulator `living_room` environment, 17 `XRPlane` entities appear. `XRPlane._plane` is the raw WebXR `XRPlane`, with `orientation` and `semanticLabel`.
- **Labels observed:** horizontal: `table` ×4 (y = 0.455, 0.612, 0.789, 0.775), `couch`, `floor`, `ceiling`; vertical: `wall`, `window`, `wall art`. **Table planes are labelled `"table"`**, `orientation: "horizontal"`.
- **Desk mock:** none of the living-room tables is in front of the default seat (nearest is at x = −1.53). The game therefore uses the spec's fallback chain: palm-rest height → snap to a horizontal plane within ±5 cm → default `head − 0.45 m`. In the emulator we also allow a URL param `?desk=<y>` (fixed desk height) so E2E is deterministic.

## e. Anchors

**Not needed for correctness.** The loom lives in `local-floor` space for one session, and we do not rely on cross-session persistence. M0 requests only `handTracking` (required) and `planeDetection` (optional). `meshDetection` and `hitTest` are unused and were dropped.

**Revised after reading the 2026 judging criteria** (`docs/RULES-NOTES.md`). Technical Implementation explicitly rewards "spatial anchoring" and "anchoring content to detected planes". So at M2/M3 we add an **optional** anchor:
- request `anchors` as optional;
- on placement, attach `XRAnchor` to the loom root (IWSDK `XRAnchor` component, `SceneUnderstandingSystem.anchoredEntities` query);
- keep the loom pose if the anchor is unavailable.

Persistent anchors ("the cloth stays on your desk") remain a stretch goal: unverified in Quest Browser, never relied on.

## f. Frame rate

- Emulator (Quest 3 profile): `session.frameRate = 90`, `supportedFrameRates = [72, 80, 90, 120]`. The emulator's nominal rate is 90, so it is **not** a proxy for Quest Browser's default.
- The hz-iwsdk-webxr skill states that Quest Browser defaults to 72 Hz.
- **Decision: stable 72 Hz.** Call `session.updateTargetFrameRate(72)` when visibility becomes `Visible` (if supported), and treat a frame time over 13 ms as the degrade trigger. A casual, slow-moving game gains little from 90 Hz, and 72 leaves headroom for Quest 2/3S. *Unverified on device.*

## g. Audio

- IWSDK's `AudioSource` component takes a `src` file path (`Types.FilePath`) and plays through `AudioUtils`. That is file-based.
- **Decision: raw Web Audio** (`new AudioContext({ latencyHint: 'interactive' })`), created and resumed on the first pinch or poke. All voices are synthesised. No audio files: the scaffold's `public/audio/chime.mp3` is deleted. *Latency in Quest Browser unverified.*

## h. Field-of-view mask and the `metaVRGlasses` profile

- **Naming correction:** IWSDK 1.0.1 has **no `fieldOfViewMask` API**. The emulator device profile is `metaVRGlasses` (`iwsdk.config.json` → `dev.emulator.device`). It carries a `visibilityMask` that the emulator draws (`visibilityMaskEnabled`).
- **Numbers** (IWER 2.8.0, `node_modules/iwer/lib/device/configs/headset/meta.js`, comment: "Angular bounds sampled from Meta VR Glasses XRView projection matrices"): **angleLeft 37°, angleRight 37°, angleUp 25°, angleDown 43°**, the same for both eyes.
  - So the spec's 37/25/43 are **half-angles from the view axis**, not horizontal/vertical/diagonal totals. **Horizontal total = 74°** (±37°). **Vertical total = 68°** (25° up, 43° down). The view is asymmetric and biased downward, which suits a desk game.
  - The profile is otherwise a Quest 3 clone (`...metaQuest3`), with `supportedFrameRates [72, 90, 96, 100, 120]`.
- **Max loom size:** assume the user looks at the loom centre, which is about 42 cm ahead and 45 cm below the eyes (≈ 61.6 cm line of sight).
  - **Width:** ±37° at 61.6 cm gives a half-width of 0.616·tan 37° ≈ **46 cm**, so the 24 cm loom (±12 cm, about ±11°) uses under a third of the width.
  - **Depth:** the near edge (33 cm ahead) sits 53.7° below horizontal, and the far edge (51 cm) 41.4° below. That is a 12.3° span, centred on a gaze of about 47°. That is well inside 25° up + 43° down.
  - **Target card** (standing at back-left, top ≈ 12 cm above the desk at 50 cm ahead, −14 cm left): about 34° below horizontal, so 13° above the gaze centre. That is inside the 25° up bound.
  - **Conclusion:** the spec footprint (24 × 18 cm) fits. The limiting direction is **up** (25°), so keep the card low (≤ 15 cm tall). The fit will be checked visually in the `metaVRGlasses` profile at M0/M1.

## i. Hand occlusion

- Depth sensing exists in the Quest 3 emulator profile (`depth-sensing` in `supportedFeatures`), and IWSDK ships `DepthSensingSystem` + `DepthOccludable` (scaffold skill `iwsdk-depth-occlusion`: request `depthSensing: { usage: 'gpu-optimized', format: 'float32' }`, register the system, tag entities).
- **Depth-only capsules on joints** need no IWSDK feature: per-joint spheres/capsules with `colorWrite = false`, `depthWrite = true`, and `renderOrder` before the threads. Joint radii are available from `getJointPose().radius` (wrist 21.5 mm, index tip 6.6 mm in the emulator).
- Plan: capsules first (cheap, no extra permission), and depth occlusion as the alternative. Both are M4/optional. *Visual quality unverified; the emulator's synthetic hands are not passthrough.*

## j. Production build

- `npm run build` → static `dist/` (`index.html` + hashed `assets/`; `base: './'`, so it works from any sub-path such as GitHub Pages).
- The emulator is **not** injected into production builds (`emulator.injectOnBuild` defaults to `false`). In dev, it is also skipped when the UA matches `/OculusBrowser/`, so Quest Browser always uses native WebXR.
- **Scaffold bundle size:** main chunk 1.68 MB gzip, plus `inter` font 283 kB, plus the msdf worker 180 kB, plus a 65 kB worker. That is about 2.2 MB gzip, **over the 2 MB budget**. The weight is mostly spatial UI (uikit + fonts + msdf). Loomsong uses zero floating menus, so `spatialUI` and `grabbing` are turned off; size is re-measured at M0.
- **Entering XR over HTTPS on a real Quest Browser: unverified** (no headset).
- **M0 bundle** (spatialUI, grabbing, environmentRaycast off): every `.js`/`.html` file in `dist/` totals **1.98 MB gzip** (`gzip -9`, summed over files). The critical path is the main chunk (1.69 MB) plus `world-initializer` (15 kB). The msdf and physics workers ship but are not used. This passes the 2 MB budget with little headroom; slimming the IWSDK core chunk is an M4 task.

## k. `localStorage`

- Works in the emulator's Chromium: probe set/get/remove returned `ok`.
- Quest Browser: *unverified*. All access goes through a try/catch wrapper with an in-memory fallback.

## Pause / resume (R3)

- `world.visibilityState` is a signal with `NonImmersive | Hidden | Visible | VisibleBlurred` (`api-reference.md` §15). Pause the simulation and audio on `VisibleBlurred`/`Hidden`, and also on `document.visibilitychange`.
- The CLI has **no command to force session blur** (`xr --help` lists none), so blur pause is covered by unit tests on the pause controller, not by E2E.

## Blockers?

None of a–e blocks the design. No fallback from §9 is needed at this stage.

## Findings from building M0 (emulator)

- **Filter lag at pinch onset.** When a pinch closes, the thumb/index midpoint jumps 2–5 cm. A One-Euro filter at 1 Hz lags for about 160 ms, so hit-testing the grab against the filtered point missed every target in the emulator E2E. Fix: on the pinch-start edge, reset the filter to the raw midpoint (`src/input/hands.ts`). This matters on a headset too.
- **Plane snap must check the polygon.** Snapping by height alone picked a `table` plane 1.5 m away whose height happened to be within 5 cm. Fix: transform the palm into the plane's local frame and require it to lie inside the plane polygon (5 cm margin).
- **Mid-air false placement.** The emulator's default hands (and real resting hands) are palm-down and still at chest height. Fix: a desk must be 25–85 cm below the eyes.
- **Headset framing for screenshots.** The emulator head looks straight ahead, so a desk-height loom (about 68° below the eye line in the default seated pose) is off-screen. The E2E calls `xr look-at` on the headset before each capture.
- **E2E result** (`npm run test:e2e`, hand input only): placement by flat palm, pinch engage/release, lever 0 grabbed → latched, shuttle grabbed → thrown across → 1 row = shed, 2 strum plucks. All 9 checks pass. Screenshots are in `artifacts/`.
