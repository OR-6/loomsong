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
const lookAt = (p) => {
  xr('set-transform', { device: 'headset', position: { x: p[0] + 0.03, y: p[1] + 0.32, z: p[2] + 0.42 } });
  xr('look-at', { device: 'headset', target: { x: p[0], y: p[1], z: p[2] } });
};
lookAt(lever);
await wait(2200);
s = run('tools/state.mjs');
check('off by default: looking does nothing', !s.debug.latched[0] && !s.debug.lookPressed, JSON.stringify([s.debug.latched[0], s.debug.lookPressed]));
run('tools/set-look.mjs');
xr('look-at', { device: 'headset', target: { x: lever[0] + 0.4, y: lever[1], z: lever[2] } });
await wait(300);
lookAt(lever);
const dots = [];
for (let i = 0; i < 10; i++) {
  await wait(150);
  dots.push(run('tools/look-dot.mjs'));
}
check('a ring of felt beads fills while you look', dots.some((d) => d.visible && d.beads >= 1), JSON.stringify(dots.map((d) => (d.visible ? "" : "x") + d.beads)));
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
