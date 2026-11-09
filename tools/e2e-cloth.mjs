#!/usr/bin/env node
/** Regression: woven rows must render (cloth was frustum-culled before M3). */
import { check, done, freshSession, setTable, state, shot, wait, xr, run } from './e2e-lib.mjs';
await freshSession();
let s = await setTable();
// Weave 3 rows programmatically through the controller (render check only).
run('tools/weave3.mjs');
await wait(2500);
const d = run('tools/cloth-debug.mjs');
check('cloth instances present', d.count === 24, `count=${d.count}`);
check('cloth not culled', d.frustumCulled === false);
const o = state().debug.loomOrigin;
xr('set-transform', { device: 'hand-right', position: { x: 0.5, y: 1.6, z: 0.3 } });
xr('set-transform', { device: 'headset', position: { x: o[0], y: o[1] + 0.22, z: o[2] + 0.2 } });
await wait(300);
shot('m3-cloth', [o[0], o[1] + 0.005, o[2] + 0.01]);
done('E2E cloth');
