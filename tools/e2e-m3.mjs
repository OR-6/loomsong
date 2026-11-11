#!/usr/bin/env node
/**
 * Emulator E2E (M3): "Fit to my hands" calibration with real emulated
 * pinches, then a shared-cloth challenge opened from a #w= link.
 */
import { cli, run, xr, wait, state, check, done, setTable, calibrate, pinchSlide, HAND } from './e2e-lib.mjs';

// ---------- A. calibration ----------
run('tools/seed-calibrate.mjs');
cli('browser', 'reload');
await wait(2500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-select-value', { device: HAND, value: 0 });
let s = await setTable();
check('calibration starts after placement', s.debug.calibrating === 'pinches:0' && s.debug.notice === 'Pinch 3 times, palm down', `${s.debug.calibrating} "${s.debug.notice}"`);
xr('set-transform', { device: HAND, position: { x: 0.05, y: 1.0, z: -0.33 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
for (let i = 0; i < 3; i++) {
  xr('set-select-value', { device: HAND, value: 1 }); await wait(350);
  xr('set-select-value', { device: HAND, value: 0 }); await wait(350);
}
s = state();
check('three pinches counted → hold step', s.debug.calibrating === 'hold:3' && s.debug.notice === 'Hold your pinch still', `${s.debug.calibrating} "${s.debug.notice}"`);
xr('set-select-value', { device: HAND, value: 1 });
await wait(2800);
xr('set-select-value', { device: HAND, value: 0 });
await wait(300);
s = state();
const saved = run('tools/read-settings.mjs').settings;
check('calibration done and saved', s.debug.calibrating === 'done' && saved.calibrateNext === false && !!saved.calibration, JSON.stringify(saved.calibration));
check('derived tuning in range', saved.calibration.pinchScale >= 0.75 && saved.calibration.pinchScale <= 1.8 && saved.calibration.radiusMul >= 1 && saved.calibration.radiusMul <= 1.8);
// Interaction still works with the new tuning: latch lever 0.
const cal = await calibrate();
const t = state().targets;
await pinchSlide(cal, t.lever0, [t.lever0[0], t.lever0[1], t.leverLatchedZRef[2] - 0.005], 0.5);
check('lever works after calibration', state().debug.latched[0] === true);

// ---------- B. shared-cloth challenge ----------
const code = Buffer.from([1, 2, 0x0f, 0xf0, 2, 0x0f, 0xff, 60]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
cli('browser', 'run', 'tools/clear-storage.mjs');
await (async () => {
  const fs = await import('node:fs');
  fs.writeFileSync('tools/.goto-share.mjs', `export default async function run({ page, frame }) { const t = frame ?? page; await t.evaluate(() => { localStorage.setItem('loomsong:progress.v1', JSON.stringify({ level: 2, best: { a1: 3, a2: 2 }, tutorialDone: true, theme: 'toy' })); location.hash = 'w=${code}'; location.reload(); }); await new Promise((r) => setTimeout(r, 3000)); return 'ok'; }`);
})();
run('tools/.goto-share.mjs');
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
s = await setTable();
check('#w= link opens a challenge', s.debug.challenge === true && s.debug.level === '' || s.debug.challenge === true, `challenge=${s.debug.challenge}`);
check('challenge notice', s.debug.notice === 'Weave this cloth', s.debug.notice);
const rows = run('tools/solve-challenge.mjs');
check('challenge woven', JSON.stringify(rows) === JSON.stringify([0x0f, 0xff]), JSON.stringify(rows));
await wait(5000);
const after = run('tools/read-settings.mjs');
check('own progress untouched', after.progress.level === 2 && !('shared' in after.progress.best), JSON.stringify(after.progress.best));
check('share hash cleared after the win', after.hash === '', after.hash);
check('last cloth saved for sharing', JSON.stringify(after.progress.lastCloth?.rows) === JSON.stringify([15, 255]));
s = state();
check('resumes own sequence (level 3, Tree)', s.debug.challenge === false && s.debug.level === 'tree', `${s.debug.level}`);
(await import('node:fs')).unlinkSync('tools/.goto-share.mjs');
done('E2E M3');
