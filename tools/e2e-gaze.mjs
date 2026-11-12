#!/usr/bin/env node
// E2E: Pip notices you. Look straight at Pip on its perch for a moment and it turns and waves, once;
// looking again straight away does nothing (it's a treat, not a tic).
import { run, xr, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
await wait(1500);
let s = run('tools/state.mjs');
const pip = s.targets.shuttle;
check('Pip has not waved yet', !(s.debug.pipNoticed > 0), String(s.debug.pipNoticed));
xr('set-transform', { device: 'headset', position: { x: pip[0] + 0.05, y: pip[1] + 0.35, z: pip[2] + 0.45 } });
xr('look-at', { device: 'headset', target: { x: pip[0], y: pip[1], z: pip[2] } });
for (let i = 0; i < 8 && !(s.debug.pipNoticed > 0); i++) {
  await wait(400);
  s = run('tools/state.mjs');
}
check('looking at Pip makes it wave', s.debug.pipNoticed === 1, String(s.debug.pipNoticed));
xr('look-at', { device: 'headset', target: { x: pip[0] + 0.5, y: pip[1], z: pip[2] } });
await wait(600);
xr('look-at', { device: 'headset', target: { x: pip[0], y: pip[1], z: pip[2] } });
await wait(2000);
s = run('tools/state.mjs');
check('not again straight away', s.debug.pipNoticed === 1, String(s.debug.pipNoticed));
done('gaze');
