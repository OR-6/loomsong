// Close-up frames of the win moment (confetti, notes, the plush), for checking the effects. Usage: node tools/capture-win.mjs OUTDIR
import { cli, run, xr, wait, freshSession, setTable } from './e2e-lib.mjs';
const OUT = process.argv[2] ?? 'artifacts';
await freshSession();
await setTable();
run('tools/seed-sprout-done.mjs'); // the Tulip
await wait(800);
const o = run('tools/state.mjs').debug.loomOrigin;
xr('set-transform', { device: 'hand-right', position: { x: o[0] + 0.9, y: o[1] + 0.6, z: o[2] + 0.9 } });
xr('set-transform', { device: 'hand-left', position: { x: o[0] - 0.9, y: o[1] + 0.6, z: o[2] + 0.9 } });
xr('set-device-state', { state: { fov: 60 } });
xr('set-transform', { device: 'headset', position: { x: o[0] + 0.05, y: o[1] + 0.3, z: o[2] + 0.42 } });
xr('look-at', { device: 'headset', target: { x: o[0], y: o[1] + 0.06, z: o[2] + 0.04 } });
run('tools/solve-nowait.mjs');
for (const ms of [350, 700, 1100, 1600, 2200, 3000]) {
  await wait(ms === 350 ? 350 : 380);
  cli('browser', 'screenshot', '--output-file', `${OUT}/win-${ms}.png`);
}
xr('set-device-state', { state: { fov: 90 } });
