// Seated captures of plushes living on the desk (review helper). Usage: node tools/capture-desk.mjs OUTDIR
import { cli, run, xr, wait, freshSession, setTable } from './e2e-lib.mjs';
const OUT = process.argv[2] ?? 'artifacts';
await freshSession();
await setTable();
console.log(JSON.stringify(run('tools/seed-desk.mjs')));
xr('set-transform', { device: 'hand-right', position: { x: 0.4, y: 0.95, z: 0.1 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
const st = run('tools/state.mjs');
const o = st.debug.loomOrigin;
xr('look-at', { device: 'headset', target: { x: o[0], y: o[1], z: o[2] + 0.1 } });
await wait(1500);
cli('browser', 'screenshot', '--output-file', `${OUT}/desk-seated.png`);
xr('set-device-state', { state: { fov: 50 } });
xr('set-transform', { device: 'headset', position: { x: o[0] - 0.2, y: o[1] + 0.22, z: o[2] + 0.42 } });
xr('look-at', { device: 'headset', target: { x: o[0] - 0.12, y: o[1] + 0.02, z: o[2] + 0.12 } });
await wait(900);
cli('browser', 'screenshot', '--output-file', `${OUT}/desk-close.png`);
xr('set-device-state', { state: { fov: 90 } });
