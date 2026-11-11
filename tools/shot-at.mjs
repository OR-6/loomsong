// World-space look-at shot with the hands out of view. Usage: node tools/shot-at.mjs ex ey ez tx ty tz fov OUT.png
import { cli, xr, wait } from './e2e-lib.mjs';
const [ex, ey, ez, tx, ty, tz, fov, out] = process.argv.slice(2);
xr('set-transform', { device: 'hand-right', position: { x: 0.6, y: 1.5, z: 0.4 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.6, y: 1.5, z: 0.4 } });
xr('set-device-state', { state: { fov: +fov } });
xr('set-transform', { device: 'headset', position: { x: +ex, y: +ey, z: +ez } });
xr('look-at', { device: 'headset', target: { x: +tx, y: +ty, z: +tz } });
await wait(700);
cli('browser', 'screenshot', '--output-file', out);
xr('set-device-state', { state: { fov: 90 } });
