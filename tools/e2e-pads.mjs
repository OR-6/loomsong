#!/usr/bin/env node
// E2E: playing with controllers. The tip of a controller pokes and its trigger pinches, so a player
// who'd rather hold them can: rest it on the table and hold the trigger to set the loom down, then
// pinch-slide a lever with the trigger. A notice says so once; back to hands, all as before.
import { run, xr, wait, freshSession, check, done } from './e2e-lib.mjs';
const PAD = 'controller-right';
await freshSession();
xr('set-input-mode', { mode: 'controller' });
xr('set-transform', { device: 'controller-left', position: { x: -0.35, y: 1.45, z: -0.25 } });
xr('set-transform', { device: PAD, position: { x: 0.35, y: 1.45, z: -0.25 } });
await wait(1500);
let s = run('tools/state.mjs');
check('controllers are noticed', s.debug.controllers === true, String(s.debug.controllers));
const hint = run('tools/hint-text.mjs');
check('the table prompt says how to set the loom down with one', hint === 'Rest a controller on your desk, hold the trigger', hint);
// where the controller's "fingertip" sits relative to the device pose
s = run('tools/state.mjs');
const off = [s.right.indexTip[0] - 0.35, s.right.indexTip[1] - 1.45, s.right.indexTip[2] + 0.25];
const at = (p) => ({ x: p[0] - off[0], y: p[1] - off[1], z: p[2] - off[2] });
// rest the tip on the desk (0.8 m) and hold the trigger
xr('set-transform', { device: PAD, position: at([0.05, 0.8, -0.33]) });
xr('set-select-value', { device: PAD, value: 1 });
for (let i = 0; i < 12 && run('tools/state.mjs').debug.phase !== 'placed'; i++) await wait(400);
xr('set-select-value', { device: PAD, value: 0 });
s = run('tools/state.mjs');
check('trigger held on the desk sets the loom down there', s.debug.phase === 'placed' && s.debug.deskSource !== 'default' && Math.abs(s.debug.deskY - 0.8) < 0.04, JSON.stringify({ phase: s.debug.phase, src: s.debug.deskSource, y: s.debug.deskY }));
await wait(800);
s = run('tools/state.mjs');
check('a notice says controllers work, once', (s.debug.notices ?? []).filter((n) => n.startsWith('Controllers work too')).length === 1, JSON.stringify(s.debug.notices));
// pinch-slide lever 1 away with the trigger
await wait(9000); // past the first-time tour
s = run('tools/state.mjs');
const L = s.targets.lever0;
const zRef = s.targets.leverLatchedZRef;
xr('set-transform', { device: PAD, position: at([L[0], L[1] + 0.03, L[2]]) });
await wait(300);
xr('animate-to', { device: PAD, position: at(L), duration: 0.25 });
await wait(450);
xr('set-select-value', { device: PAD, value: 1 });
await wait(350);
xr('animate-to', { device: PAD, position: at([L[0], L[1], zRef ? zRef[2] : L[2] - 0.06]), duration: 0.6 });
await wait(900);
xr('set-select-value', { device: PAD, value: 0 });
await wait(500);
s = run('tools/state.mjs');
check('the trigger slides a lever away (latched)', s.debug.latched[0] === true, JSON.stringify(s.debug.latched));
xr('set-input-mode', { mode: 'hand' });
await wait(1000);
s = run('tools/state.mjs');
check('hands again: back to hands', s.debug.controllers === false, String(s.debug.controllers));
done('controllers');
