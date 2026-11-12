#!/usr/bin/env node
/**
 * Emulator E2E (M0): drives IWER through the IWSDK CLI with hand input only.
 * Requires: `npx @iwsdk/cli dev up --ai-mode agent --headless --allow-browser-automation`.
 * Steps: enter XR → hand mode → flat palm on desk for >1 s → loom placed →
 * pinch-slide lever 0 away → latched → pinch-slide shuttle across → 1 row.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const cli = (...args) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', ...args, '--raw'], { encoding: 'utf8' }));
const xr = (action, input) => cli('xr', action, '--input-json', JSON.stringify(input ?? {}));
const state = () => {
  const out = execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/state.mjs'], { encoding: 'utf8' });
  return JSON.parse(out).data.result;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};
const shot = (name, look) => {
  mkdirSync('artifacts', { recursive: true });
  if (look) xr('look-at', { device: 'headset', target: { x: look[0], y: look[1], z: look[2] } });
  cli('browser', 'screenshot', '--output-file', `artifacts/${name}.png`);
};

const HAND = 'hand-right';
const FLAT = { pitch: 0, yaw: 0, roll: 0 };

// Fresh page and fresh storage (a loom saved by the previous suite would resume), hands raised
// first so neither palm reads as a desk during the reload. Then enter XR with hands only.
try {
  if (xr('status').sessionActive) {
    xr('set-transform', { device: 'hand-right', position: { x: 0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
    xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
  }
} catch {
  /* no session yet */
}
execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/clear-storage.mjs'], { encoding: 'utf8' });
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
// Park the left hand out of the way (raised, so it never reads as a desk).
xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-select-value', { device: HAND, value: 0 });

let s = state();
check('starts unplaced', s.debug.phase !== 'placed', `phase=${s.debug.phase}`);

// 1. Set the table: right palm flat & still on a desk ~0.77 m (seated head 1.2).
xr('set-transform', { device: HAND, position: { x: 0.05, y: 0.8, z: -0.33 }, orientation: FLAT });
await wait(1800);
s = state();
check('loom placed by flat palm', s.debug.phase === 'placed', `source=${s.debug.deskSource} deskY=${s.debug.deskY}`);
await wait(800); // bloom animation
shot('m0-01-placed', s.debug.loomOrigin);

// Calibrate pinch-point offset relative to the hand pose.
xr('set-transform', { device: HAND, position: { x: 0.05, y: 1.0, z: -0.33 }, orientation: FLAT });
xr('set-select-value', { device: HAND, value: 1 });
await wait(600);
s = state();
const off = s.right.pinchPoint.map((v, i) => v - [0.05, 1.0, -0.33][i]);
check('pinch engages at select=1', s.right.pinching, `pinchMm=${s.right.pinchMm}`);
xr('set-select-value', { device: HAND, value: 0 });
await wait(300);
s = state();
check('pinch releases at select=0', !s.right.pinching, `pinchMm=${s.right.pinchMm}`);
const handAt = (p) => ({ x: p[0] - off[0], y: p[1] - off[1], z: p[2] - off[2] });

// 2. Pinch-slide lever 0 away from the user.
const T = s.targets;
const lever0 = T.lever0;
const away = [lever0[0] - (T.lever0[0] - T.lever0[0]), lever0[1], T.leverLatchedZRef[2]];
xr('set-transform', { device: HAND, position: handAt([lever0[0], lever0[1] + 0.03, lever0[2]]), orientation: FLAT });
await wait(400);
xr('animate-to', { device: HAND, position: handAt(lever0), duration: 0.3 });
await wait(600);
xr('set-select-value', { device: HAND, value: 1 });
await wait(400);
s = state();
check('lever 0 grabbed', JSON.stringify(s.debug.holding.right) === '{"kind":"lever","k":0}', JSON.stringify(s.debug.holding.right));
xr('animate-to', { device: HAND, position: handAt([lever0[0], lever0[1], away[2] - 0.005]), duration: 0.6 });
await wait(900);
xr('set-select-value', { device: HAND, value: 0 });
await wait(600);
s = state();
check('lever 0 latched', s.debug.latched[0] === true, `latched=${JSON.stringify(s.debug.latched)} shed=${s.debug.shed}`);
shot('m0-02-lever', s.debug.loomOrigin);

// 3. Pinch-slide the shuttle across.
const a = s.targets.shuttle;
const b = s.targets.shuttleMax;
xr('set-transform', { device: HAND, position: handAt([a[0], a[1] + 0.03, a[2]]), orientation: FLAT });
await wait(400);
xr('animate-to', { device: HAND, position: handAt(a), duration: 0.3 });
await wait(600);
xr('set-select-value', { device: HAND, value: 1 });
await wait(400);
s = state();
check('shuttle grabbed', s.debug.holding.right?.kind === 'shuttle', JSON.stringify(s.debug.holding.right));
const beyond = [b[0] + (b[0] - a[0]) * 0.1, b[1], b[2] + (b[2] - a[2]) * 0.1];
xr('animate-to', { device: HAND, position: handAt(beyond), duration: 1.0 });
await wait(1400);
xr('set-select-value', { device: HAND, value: 0 });
await wait(800);
s = state();
check('one row committed = shed', s.debug.rows.length >= 1 && s.debug.rows[0] === s.debug.shed, `rows=${JSON.stringify(s.debug.rows)} shed=${s.debug.shed}`);
check('strum plucked lifted warps', s.debug.plucks >= 2, `plucks=${s.debug.plucks}`);
shot('m0-03-row', s.debug.loomOrigin);

console.log(failures === 0 ? '\nE2E M0: ALL PASS' : `\nE2E M0: ${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
