#!/usr/bin/env node
// Review stills from a seated eye height (hands only): first minutes, the aha, the win,
// desk plushes, Night, Sea. Usage: node tools/capture-review.mjs OUTDIR
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, state, HAND } from './e2e-lib.mjs';

const OUT = process.argv[2] ?? 'artifacts/review';
mkdirSync(OUT, { recursive: true });
let O = null;
const seat = () => xr('set-transform', { device: 'headset', position: { x: O[0] + 0.02, y: O[1] + 0.36, z: O[2] + 0.42 } });
const look = (dx = 0, dy = 0.02, dz = -0.02) => xr('look-at', { device: 'headset', target: { x: O[0] + dx, y: O[1] + dy, z: O[2] + dz } });
const snap = (name) => { cli('browser', 'screenshot', '--output-file', `${OUT}/${name}.png`); console.log('shot', name); };
const evalIn = (fn) => run(fn);
const hands = () => {
  xr('set-transform', { device: 'hand-left', position: { x: O[0] - 0.45, y: O[1] + 0.1, z: O[2] + 0.45 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
  xr('set-transform', { device: HAND, position: { x: O[0] + 0.42, y: O[1] + 0.12, z: O[2] + 0.42 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
};

run('tools/clear-storage.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-device-state', { state: { fov: 70 } });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: -32, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.45, y: 1.0, z: 0.1 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-select-value', { device: HAND, value: 0 });
xr('set-transform', { device: HAND, position: { x: 0.03, y: 0.84, z: -0.3 }, orientation: { pitch: 0, yaw: 0, roll: 60 } });
await wait(900);
snap('01-rest-your-hand');
xr('set-transform', { device: HAND, position: { x: 0.03, y: 0.8, z: -0.3 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(1500);
O = state().debug.loomOrigin;
hands();
await wait(1800);
seat(); look();
snap('02-level1-start');
// the first lever lifted: the shuttle hint
evalIn('tools/review-step.mjs');
await wait(700);
seat(); look();
snap('03-lever-up-shuttle-hint');
// two stem rows woven: the tutorial asks for more threads without pointing
evalIn('tools/review-step.mjs');
seat(); look();
snap('04a-more-threads');
// lever 1 joins: the aha
evalIn('tools/review-step.mjs');
seat(); look();
snap('04b-two-levers-aha');
// the win: plush pops and dances
run('tools/solve-nowait.mjs');
await wait(2200);
seat(); look(0, 0.08, 0.1);
snap('05-win-plush-dance');
await wait(1800);
snap('05b-plush-bow');
await wait(9000);
// desk plushes, Home loaded
run('tools/seed-desk.mjs');
await wait(1500);
seat(); look(0, 0.01, 0.06);
snap('06-desk-plushes');
// Night: mystery levers
run('tools/seed-night.mjs');
await wait(1500);
seat(); look();
snap('07-night');
// Sea: two-colour weft
run('tools/seed-sea-boat.mjs');
await wait(1500);
seat(); look();
snap('08-sea-boat');
xr('set-device-state', { state: { fov: 90 } });
console.log('done', OUT);
