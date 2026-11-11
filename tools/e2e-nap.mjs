// E2E: welcome back. After hours away Pip is asleep on the perch (felt Zs drift up);
// a hand near the controls wakes it. Optional: screenshots to OUT dir.
import { cli, run, xr, wait, freshSession, setTable, check, done, HAND } from './e2e-lib.mjs';
const OUT = process.argv[2];
run('tools/clear-storage.mjs');
run('tools/seed-away.mjs');
await freshSession({ clear: false });
await setTable();
await wait(1200);
let s = run('tools/state.mjs');
const nap = () => run('tools/nap-state.mjs');
let n = nap();
check('Pip is asleep after hours away', n.asleep === true, JSON.stringify(n));
const o = s.debug.loomOrigin;
if (OUT) {
  xr('set-transform', { device: HAND, position: { x: o[0] + 0.6, y: o[1] + 0.5, z: o[2] + 0.6 } });
  xr('set-device-state', { state: { fov: 40 } });
  xr('set-transform', { device: 'headset', position: { x: o[0] - 0.08, y: o[1] + 0.16, z: o[2] + 0.3 } });
  xr('look-at', { device: 'headset', target: { x: o[0] - 0.17, y: o[1] + 0.05, z: o[2] + 0.02 } });
  await wait(2500);
  cli('browser', 'screenshot', '--output-file', `${OUT}/nap-asleep.png`);
}
// the placing hand lifts away, then reaches back in toward a lever
xr('set-transform', { device: HAND, position: { x: o[0] + 0.5, y: o[1] + 0.4, z: o[2] + 0.5 } });
await wait(600);
n = nap();
check('still asleep while the hands are away', n.asleep === true, JSON.stringify(n));
const t = s.targets;
xr('set-transform', { device: HAND, position: { x: t.lever0[0], y: t.lever0[1] + 0.03, z: t.lever0[2] }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(900);
n = nap();
check('a hand near the controls wakes Pip', n.asleep === false, JSON.stringify(n));
if (OUT) {
  await wait(200);
  cli('browser', 'screenshot', '--output-file', `${OUT}/nap-wake.png`);
  xr('set-device-state', { state: { fov: 90 } });
}
done('nap');
