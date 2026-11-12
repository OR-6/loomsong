#!/usr/bin/env node
// E2E: stroke Pip. A flat palm passing over Pip (not a poke, not a pinch) makes it close its eyes and trill.
import { run, xr, wait, freshSession, setTable, check, done, HAND } from './e2e-lib.mjs';
await freshSession();
await setTable();
await wait(1200);
let s = run('tools/state.mjs');
const pip = s.targets.shuttle;
// find where the palm sits relative to the hand's pose, then hold it 3 cm over Pip
xr('set-transform', { device: HAND, position: { x: pip[0], y: pip[1] + 0.2, z: pip[2] }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(300);
s = run('tools/state.mjs');
const off = s.right.palm.map((v, i) => v - [pip[0], pip[1] + 0.2, pip[2]][i]);
const at = (dx) => ({ x: pip[0] - off[0] + dx, y: pip[1] + 0.03 - off[1], z: pip[2] - off[2] });
check('Pip has not been stroked yet', !(s.debug.pipPetted > 0), String(s.debug.pipPetted));
for (let k = -4; k <= 4; k++) {
  xr('set-transform', { device: HAND, position: at(k * 0.012), orientation: { pitch: 0, yaw: 0, roll: 0 } });
  await wait(90);
}
await wait(300);
s = run('tools/state.mjs');
check('a palm stroked over Pip: it purrs', s.debug.pipPetted >= 1, String(s.debug.pipPetted));
check('a stroke is not a throw', s.debug.rows.length === 0, JSON.stringify(s.debug.rows));
done('pet');
