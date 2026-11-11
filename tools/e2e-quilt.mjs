// E2E: a finished chapter's quilt hangs on the real wall straight ahead (the emulator's
// living room has walls); after a reload it is still there.
import { cli, run, xr, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
let w = run('tools/quilt-where.mjs');
check('no quilt before any chapter is finished', Object.keys(w.quilts).length === 0, JSON.stringify(w.quilts));
run('tools/seed-garden-all.mjs');
await wait(2500);
w = run('tools/quilt-where.mjs');
check('a wall was found ahead of the seat', !!w.wall, JSON.stringify(w.wall));
check('the Garden quilt hangs on it', !!w.quilts.garden, JSON.stringify(w.quilts));
if (w.quilts.garden) {
  const [x, y, z] = w.quilts.garden;
  check('in front of the player, about eye height', z < w.head[2] - 0.3 && Math.abs(y - (w.head[1] + 0.18)) < 0.05, JSON.stringify({ q: w.quilts.garden, head: w.head }));
  if (process.argv[2]) {
    xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
    xr('look-at', { device: 'headset', target: { x, y: y - 0.25, z } });
    await wait(600);
    cli('browser', 'screenshot', '--output-file', process.argv[2]);
  }
}
done('quilt');
