#!/usr/bin/env node
/**
 * Emulator E2E (M2):
 *  A. No-hand fallback: default desk height, nudge arrows, poke to raise.
 *  B. Generated level 4 played to a win with hands only (optimal lever
 *     path computed from the live level), star total and plaque update.
 *  C. High contrast applied live.
 */
import { cli, run, xr, wait, state, check, done, shot, setTable, calibrate, pinchSlide, poke, HAND } from './e2e-lib.mjs';

// ---------- A. fallback ----------
run('tools/clear-storage.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-connected', { device: 'hand-left', connected: false });
xr('set-connected', { device: 'hand-right', connected: false });
await wait(9500);
let s = state();
check('no hands for 8 s → default placement', s.debug.phase === 'placed' && s.debug.deskSource === 'default', `${s.debug.phase} ${s.debug.deskSource}`);
check('default desk = head − 0.45 m', Math.abs(s.debug.deskY - (s.targets.head[1] - 0.45)) < 0.005, `deskY=${s.debug.deskY} head=${s.targets.head[1]}`);
check('nudge notice shown', s.debug.notice === 'Nudge to your desk', s.debug.notice);
xr('set-connected', { device: 'hand-right', connected: true });
await wait(500);
const cal0 = await calibrate();
const y0 = s.debug.loomOrigin[1];
await poke(cal0, state().targets.nudgeUp);
s = state();
check('poke ▲ raises the loom 1 cm', Math.abs(s.debug.loomOrigin[1] - (y0 + 0.01)) < 0.002, `${y0} → ${s.debug.loomOrigin[1]}`);
shot('m2-01-fallback', s.debug.loomOrigin);

// ---------- B. generated level 4 ----------
run('tools/seed-level4.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-connected', { device: 'hand-left', connected: true });
xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-select-value', { device: HAND, value: 0 });
s = await setTable();
const L = run('tools/level-info.mjs');
check('level 3 is the Duck', L.id === 'duck' && L.index === 2, `${L.id} levers=${L.tieUp.length} rows=${L.target.length} par=${L.par}`);
check('the plate keeps the name a surprise until it is woven', s.debug.plaque === 'What is it?', s.debug.plaque);
check('workshop style still locked (the Garden needs the Duck)', s.debug.workshopUnlocked !== true, String(s.debug.workshopUnlocked));
const cal = await calibrate();

// Optimal lever states via DP (same rule as par.ts).
const n = L.tieUp.length, S = 1 << n;
const shedOf = (st) => L.tieUp.reduce((m, t, k) => ((st >> k) & 1 ? m | t : m), 0);
const pc = (x) => x.toString(2).replace(/0/g, '').length;
let cost = Array(S).fill(Infinity); cost[0] = 0; const back = [];
for (const row of L.target) {
  const next = Array(S).fill(Infinity), from = Array(S).fill(-1);
  for (let st = 0; st < S; st++) if (shedOf(st) === row)
    for (let p = 0; p < S; p++) if (cost[p] + pc(p ^ st) < next[st]) { next[st] = cost[p] + pc(p ^ st); from[st] = p; }
  back.push(from); cost = next;
}
let st = cost.indexOf(Math.min(...cost)); const path = [];
for (let r = L.target.length - 1; r >= 0; r--) { path.unshift(st); st = back[r][st]; }
check('solver par matches level par', Math.min(...cost) === L.par, `${Math.min(...cost)} vs ${L.par}`);

const T = () => state().targets;
const setLever = async (k, on) => {
  const t = T();
  const p = t[`lever${k}`];
  const latchedZ = t.leverLatchedZRef[2];
  const toZ = on ? latchedZ - 0.005 : latchedZ + 0.055;
  await pinchSlide(cal, p, [p[0], p[1], toZ], 0.5);
};
const pass = async (toMax) => {
  const t = T();
  const a = t.shuttle, b = toMax ? t.shuttleMax : t.shuttleMin;
  await pinchSlide(cal, a, [b[0] + (b[0] - a[0]) * 0.08, b[1], b[2]], 0.9);
};
let cur = 0, toMax = true;
for (let r = 0; r < path.length; r++) {
  const want = path[r];
  for (let k = 0; k < n; k++) if (((cur ^ want) >> k) & 1) await setLever(k, ((want >> k) & 1) === 1);
  cur = want;
  await pass(toMax);
  toMax = !toMax;
  const rows = state().debug.rows.length;
  if (rows !== r + 1 && state().debug.flow === 'play') { check(`row ${r + 1} woven`, false, `rows=${rows}`); break; }
}
s = state();
check('level 4 won at par (3 stars)', s.debug.stars === 3 && s.debug.flow !== 'play', `flow=${s.debug.flow} stars=${s.debug.stars} rows=${JSON.stringify(s.debug.rows)}`);
check('finishing the Garden unlocks the workshop style', state().debug.workshopUnlocked === true);
check('9 stars in all', Object.values(run('tools/read-progress.mjs').best).reduce((a, b) => a + b, 0) === 9);
shot('m2-02-level4-win', s.debug.loomOrigin);
// after the Duck comes the Table, Garden's last picture (it needs a friend from the shelf)
for (let i = 0; i < 60; i++) {
  await wait(500);
  s = state();
  if (s.debug.level === 'table' && s.debug.flow === 'play') break;
}
check('advanced to level 4 (the Table)', s.debug.level === 'table' && s.debug.flow === 'play', `${s.debug.level} ${s.debug.flow}`);

// ---------- C. high contrast ----------
run('tools/set-hc.mjs');
await wait(400);
s = state();
check('high contrast applied live', s.debug.highContrast === true);
shot('m2-03-high-contrast', s.debug.loomOrigin);
done('E2E M2');
