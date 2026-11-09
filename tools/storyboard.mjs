#!/usr/bin/env node
/**
 * Storyboard stills for the video (SUBMISSION-META §4), captured in the
 * emulator from a seated eye height with emulated hands only.
 * Output: artifacts/storyboard/sb-*.png (+ contact sheet via ffmpeg).
 */
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, state, calibrate, pinchSlide, HAND } from './e2e-lib.mjs';

const DIR = 'artifacts/storyboard';
mkdirSync(DIR, { recursive: true });
const HEAD = { x: 0, y: 1.2, z: 0 };
let O = null;
const seat = () => xr('set-transform', { device: 'headset', position: { x: O[0] + 0.02, y: O[1] + 0.3, z: O[2] + 0.3 } });
// Narrower capture lens (the emulator's default is Quest-wide); reset after.
const lens = (deg) => xr('set-device-state', { state: { fov: deg } });
const look = (dx = 0, dy = 0.01, dz = -0.02) => xr('look-at', { device: 'headset', target: { x: O[0] + dx, y: O[1] + dy, z: O[2] + dz } });
const snap = (name) => { cli('browser', 'screenshot', '--output-file', `${DIR}/${name}.png`); console.log('shot', name); };
const force0 = () => run('tools/force-degrade0.mjs');

// Fresh first run, seated head.
run('tools/clear-storage.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
lens(55);
xr('set-transform', { device: 'headset', position: HEAD, orientation: { pitch: -35, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.45, y: 1.0, z: 0.1 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-select-value', { device: HAND, value: 0 });
// 01: the prompt, hand hovering (rolled, so it doesn't place yet)
xr('set-transform', { device: HAND, position: { x: 0.03, y: 0.84, z: -0.3 }, orientation: { pitch: 0, yaw: 0, roll: 60 } });
await wait(600);
force0();
snap('sb-01-rest-your-hand');
// 02: palm flat on the desk → loom unfolds
xr('set-transform', { device: HAND, position: { x: 0.03, y: 0.8, z: -0.3 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(1500);
let s = state();
O = s.debug.loomOrigin;
await wait(700);
force0();
seat(); look();
snap('sb-02-loom-unfolds');
// 03: slide lever 0 away (hand on the knob mid-slide)
const cal = await calibrate();
seat(); look();
let t = state().targets;
await pinchSlide(cal, t.lever0, [t.lever0[0], t.lever0[1], t.leverLatchedZRef[2] - 0.005], 0.5);
force0(); seat(); look();
snap('sb-03-lever-lifts-threads');
// 04: shuttle mid-pass (strum)
t = state().targets;
const sub = (p, o) => ({ x: p[0] - o[0], y: p[1] - o[1], z: p[2] - o[2] });
xr('set-transform', { device: HAND, position: sub([t.shuttle[0], t.shuttle[1] + 0.03, t.shuttle[2]], cal.pinchOff), orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(300);
xr('animate-to', { device: HAND, position: sub(t.shuttle, cal.pinchOff), duration: 0.25 });
await wait(450);
xr('set-select-value', { device: HAND, value: 1 });
await wait(300);
xr('animate-to', { device: HAND, position: sub([t.shuttleMax[0] + 0.02, t.shuttleMax[1], t.shuttleMax[2]], cal.pinchOff), duration: 2.4 });
await wait(1100);
seat(); look();
snap('sb-04-shuttle-strums');
await wait(1600);
xr('set-select-value', { device: HAND, value: 0 });
await wait(600);
// 05: first row + card hint
seat(); look(-0.05, 0.02, -0.03);
snap('sb-05-first-row-card');
// 06: finish level 1 programmatically, capture playback glow + stars
run('tools/finish-level1.mjs');
await wait(1400);
force0(); seat(); look();
snap('sb-06-cloth-plays-back');
await wait(5000);
// 07: level 2 with a wrong row → card cross; then undo bobbin
run('tools/weave-wrong.mjs');
await wait(1500);
seat(); look(-0.06, 0.03, -0.04);
snap('sb-07-wrong-row-cross');
// 08: workshop style (seed unlock), a few rows in
run('tools/seed-workshop.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
lens(55);
xr('set-transform', { device: 'headset', position: HEAD });
xr('set-transform', { device: 'hand-left', position: { x: -0.45, y: 1.0, z: 0.1 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-transform', { device: HAND, position: { x: 0.03, y: 0.8, z: -0.3 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(2200);
O = state().debug.loomOrigin;
run('tools/weave3.mjs');
await wait(2600);
xr('set-transform', { device: HAND, position: { x: 0.5, y: 1.5, z: 0.4 } });
force0(); seat(); look();
snap('sb-08-workshop-style');
// 09: high contrast
run('tools/set-hc.mjs');
await wait(500);
seat(); look();
snap('sb-09-high-contrast');
// 10: the 2D page with the share card
lens(90);
xr('exit');
await wait(800);
run('tools/seed-cloth.mjs');
await wait(300);
snap('sb-10-share-card');
console.log('storyboard done');
