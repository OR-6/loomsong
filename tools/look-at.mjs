// Point the emulated headset from loom-relative offsets and screenshot. Usage: node tools/look-at.mjs dx dy dz tx ty tz OUT.png
import { cli, xr, wait, run } from './e2e-lib.mjs';
const [x, y, z, tx, ty, tz, out] = process.argv.slice(2);
const o = run("tools/state.mjs").debug.loomOrigin;
xr('set-device-state', { state: { fov: 50 } });
xr('set-transform', { device: 'headset', position: { x: o[0] + +x, y: o[1] + +y, z: o[2] + +z } });
xr('look-at', { device: 'headset', target: { x: o[0] + +tx, y: o[1] + +ty, z: o[2] + +tz } });
await wait(700);
cli('browser', 'screenshot', '--output-file', out);
xr('set-device-state', { state: { fov: 90 } });
