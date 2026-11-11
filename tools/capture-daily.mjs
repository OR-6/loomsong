// Captures the picture-of-the-day ball (wrapped) up close and from the seat. Usage: node tools/capture-daily.mjs OUTDIR
import { cli, run, xr, wait, freshSession, setTable } from './e2e-lib.mjs';
const OUT = process.argv[2] ?? 'artifacts';
await freshSession();
await setTable();
run('tools/seed-sprout-done.mjs');
await wait(1200);
const o = run('tools/state.mjs').debug.loomOrigin;
xr('set-transform', { device: 'hand-right', position: { x: o[0] + 0.45, y: o[1] + 0.1, z: o[2] + 0.45 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
const look = (p, t, name, fov) => {
  xr('set-device-state', { state: { fov } });
  xr('set-transform', { device: 'headset', position: { x: o[0] + p[0], y: o[1] + p[1], z: o[2] + p[2] } });
  xr('look-at', { device: 'headset', target: { x: o[0] + t[0], y: o[1] + t[1], z: o[2] + t[2] } });
};
look([-0.2, 0.2, 0.5], [-0.32, 0.02, 0.16], 'close', 50);
await wait(800);
cli('browser', 'screenshot', '--output-file', `${OUT}/daily-close.png`);
look([0.02, 0.36, 0.42], [0, 0.02, -0.02], 'seat', 70);
await wait(800);
cli('browser', 'screenshot', '--output-file', `${OUT}/daily-seated.png`);
xr('set-device-state', { state: { fov: 90 } });
