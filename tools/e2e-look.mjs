#!/usr/bin/env node
// E2E: Look to play (no hands). With the setting on, looking at a lever for a moment latches it, a
// felt dot grows while you look, and looking at Pip throws a row. Off by default: looking does nothing.
import { run, xr, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
await wait(1500);
// hands down by your sides, out of the way
xr('set-transform', { device: 'hand-right', position: { x: 0.5, y: 0.3, z: 0.5 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.5, y: 0.3, z: 0.5 } });
let s = run('tools/state.mjs');
const lever = s.targets.lever0;
// the game's look points ~12° below head-forward (eyes drop first): aim the head that much above the target
const lookAt = (p) => {
  const h = [p[0] + 0.03, p[1] + 0.32, p[2] + 0.42];
  let d = [p[0] - h[0], p[1] - h[1], p[2] - h[2]];
  const n = Math.hypot(...d);
  d = d.map((v) => v / n);
  const horiz = Math.hypot(d[0], d[2]);
  const pitch = Math.atan2(d[1], horiz) + (12 * Math.PI) / 180;
  const t = [h[0] + (d[0] / horiz) * Math.cos(pitch), h[1] + Math.sin(pitch), h[2] + (d[2] / horiz) * Math.cos(pitch)];
  xr('set-transform', { device: 'headset', position: { x: h[0], y: h[1], z: h[2] } });
  xr('look-at', { device: 'headset', target: { x: t[0], y: t[1], z: t[2] } });
};
lookAt(lever);
await wait(2200);
s = run('tools/state.mjs');
check('off by default: looking does nothing', !s.debug.latched[0] && !s.debug.lookPressed, JSON.stringify([s.debug.latched[0], s.debug.lookPressed]));
// still looking at the lever: switch Look to play on from inside the page and watch the ring from its start
process.env.LOOK_WATCH = '1';
process.env.LOOK_ENABLE = '1';
const ring = run('tools/look-dot.mjs'); // the ring fills bead by bead
delete process.env.LOOK_WATCH;
delete process.env.LOOK_ENABLE;
check('a ring of felt beads fills while you look', ring.visible && ring.seen.length >= 3 && ring.seen.some((b, i) => i > 0 && b > ring.seen[i - 1]), JSON.stringify(ring.seen));
for (let i = 0; i < 8 && !s.debug.latched[0]; i++) {
  await wait(300);
  s = run('tools/state.mjs');
}
check('looking at a lever latches it', s.debug.latched[0] === true && s.debug.lookPressed === 'lever0', JSON.stringify([s.debug.latched, s.debug.lookPressed]));
await wait(2500);
s = run('tools/state.mjs');
check('keep looking: it stays latched (one press per look)', s.debug.latched[0] === true && !run('tools/look-dot.mjs').visible, JSON.stringify(s.debug.latched));
const rows = s.debug.rows.length;
const pip = s.targets.shuttle;
lookAt(pip);
for (let i = 0; i < 12 && s.debug.rows.length === rows; i++) {
  await wait(400);
  s = run('tools/state.mjs');
}
check('looking at Pip weaves a row', s.debug.rows.length === rows + 1 && s.debug.lookPressed === 'pip', JSON.stringify([rows, s.debug.rows.length, s.debug.lookPressed]));
done('look');
