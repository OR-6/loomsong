/** Shared helpers for emulator E2E scripts (IWSDK CLI + IWER, hands only). */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

export const cli = (...args) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', ...args, '--raw'], { encoding: 'utf8' }));
export const xr = (action, input) => cli('xr', action, '--input-json', JSON.stringify(input ?? {}));
export const run = (script) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', script], { encoding: 'utf8' })).data.result;
export const state = () => run('tools/state.mjs');
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
export const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};
export const done = (label) => {
  console.log(failures === 0 ? `\n${label}: ALL PASS` : `\n${label}: ${failures} FAILURE(S)`);
  process.exit(failures ? 1 : 0);
};

export const HAND = 'hand-right';
export const FLAT = { pitch: 0, yaw: 0, roll: 0 };

export function shot(name, look) {
  mkdirSync('artifacts', { recursive: true });
  if (look) xr('look-at', { device: 'headset', target: { x: look[0], y: look[1], z: look[2] } });
  cli('browser', 'screenshot', '--output-file', `artifacts/${name}.png`);
}

/** Fresh page (optionally with cleared storage), XR entered, hands only. */
export async function freshSession({ clear = true } = {}) {
  // hands up first: the emulator keeps its session through a reload, and a palm left flat at desk
  // height would place the loom during the reload wait
  try {
    if (xr('status').sessionActive) {
      xr('set-transform', { device: HAND, position: { x: 0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
      xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
    }
  } catch {
    /* no session yet */
  }
  if (clear) run('tools/clear-storage.mjs');
  cli('browser', 'reload');
  await wait(2500);
  // a reload that didn't really happen would leave saving blocked (and a later reload would lose progress)
  if (run('tools/unblock-storage.mjs') === 'unblocked') console.log('note: the reload did not reset the page; saving unblocked');
  if (!xr('status').sessionActive) xr('enter');
  xr('set-input-mode', { mode: 'hand' });
  // Seated player: eyes 1.2 m above the floor (desk ~0.4 m below the eyes).
  xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
  xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
  // the right hand up and on its side too: a flat palm left at desk height would place the loom at once
  xr('set-transform', { device: HAND, position: { x: 0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
  xr('set-select-value', { device: HAND, value: 0 });
}

/** Rest the right palm on a desk until the loom places. */
export async function setTable() {
  xr('set-transform', { device: HAND, position: { x: 0.05, y: 0.8, z: -0.33 }, orientation: FLAT });
  await wait(1800);
  await wait(800);
  return state();
}

/** Measure pinch-point and index-tip offsets from the hand pose. */
export async function calibrate() {
  const P = [0.05, 1.0, -0.33];
  xr('set-transform', { device: HAND, position: { x: P[0], y: P[1], z: P[2] }, orientation: FLAT });
  await wait(300);
  let s = state();
  const indexOff = s.right.indexTip.map((v, i) => v - P[i]);
  xr('set-select-value', { device: HAND, value: 1 });
  await wait(500);
  s = state();
  const pinchOff = s.right.pinchPoint.map((v, i) => v - P[i]);
  xr('set-select-value', { device: HAND, value: 0 });
  await wait(300);
  return { pinchOff, indexOff };
}

const sub = (p, o) => ({ x: p[0] - o[0], y: p[1] - o[1], z: p[2] - o[2] });

/** Pinch at `from`, slide to `to` over `secs`, release. */
export async function pinchSlide(cal, from, to, secs = 0.6) {
  xr('set-transform', { device: HAND, position: sub([from[0], from[1] + 0.03, from[2]], cal.pinchOff), orientation: FLAT });
  await wait(300);
  xr('animate-to', { device: HAND, position: sub(from, cal.pinchOff), duration: 0.25 });
  await wait(450);
  xr('set-select-value', { device: HAND, value: 1 });
  await wait(350);
  xr('animate-to', { device: HAND, position: sub(to, cal.pinchOff), duration: secs });
  await wait(secs * 1000 + 300);
  xr('set-select-value', { device: HAND, value: 0 });
  await wait(450);
  xr('animate-to', { device: HAND, position: sub([to[0], to[1] + 0.06, to[2]], cal.pinchOff), duration: 0.2 });
  await wait(350);
}

/** Poke straight down onto `p` with the open hand's index tip. */
export async function poke(cal, p) {
  xr('set-select-value', { device: HAND, value: 0 });
  xr('set-transform', { device: HAND, position: sub([p[0], p[1] + 0.05, p[2]], cal.indexOff), orientation: FLAT });
  await wait(350);
  xr('animate-to', { device: HAND, position: sub([p[0], p[1] + 0.002, p[2]], cal.indexOff), duration: 0.18 });
  await wait(400);
  xr('animate-to', { device: HAND, position: sub([p[0], p[1] + 0.07, p[2]], cal.indexOff), duration: 0.2 });
  await wait(400);
}
