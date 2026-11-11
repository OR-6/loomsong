// E2E: the room remembers. Place the loom, leave XR, come back: the persistent anchor
// returns and the loom stands where it was, without setting the table again.
import { run, xr, wait, freshSession, setTable, check, done, state } from './e2e-lib.mjs';
await freshSession();
const first = await setTable();
await wait(1500);
let s = state();
check('placed by the palm', s.debug.phase === 'placed', s.debug.deskSource);
check('held by the room anchor', s.debug.anchored === true);
const saved = run('tools/read-progress.mjs');
check('its pose is saved under the anchor', !!saved?.loom?.uuid, JSON.stringify(saved?.loom));
const before = s.debug.loomOrigin;
xr('exit');
await wait(1200);
// the hand is somewhere else this time: only the anchor can bring the loom back
xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-right', position: { x: 0.35, y: 1.4, z: -0.1 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
await wait(2500);
s = state();
check('placed again without setting the table', s.debug.phase === 'placed' && s.debug.deskSource === 'resumed', `${s.debug.phase} ${s.debug.deskSource}`);
const after = s.debug.loomOrigin ?? [9, 9, 9];
const d = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
check('right where it was', d < 0.01, `${JSON.stringify(before)} → ${JSON.stringify(after)} (${(d * 100).toFixed(1)} cm)`);
check('it says so', (s.debug.notices ?? []).includes('Right where you left it'), JSON.stringify(s.debug.notices));
void first;
done('resume');
