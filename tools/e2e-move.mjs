#!/usr/bin/env node
// E2E: move the loom from inside the headset. Poke the name plate: it only asks; poke again and the
// loom folds away; rest a hand somewhere else on the desk and it unfolds there, the picture kept.
import { run, xr, wait, freshSession, setTable, check, done, HAND, FLAT } from './e2e-lib.mjs';
await freshSession();
let s = await setTable();
const before = s.debug.loomOrigin;
const level = s.debug.level;
await wait(16000); // a session older than the placement timeouts (a move must still wait for your hand)
let p = run('tools/plate-poke.mjs');
check('the plate is a control', p.spot, JSON.stringify(p));
check('one poke only asks', p.phase === 'placed' && /Move the loom\? Poke it again/.test(p.notice ?? ''), JSON.stringify(p));
await wait(400);
p = run('tools/plate-poke.mjs');
check('a second poke folds the loom away', p.phase !== 'placed' && p.moved === 1, JSON.stringify(p));
// you've shifted along the desk: sit 30 cm further left, then rest the right palm there
xr('set-transform', { device: HAND, position: { x: 0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
xr('set-transform', { device: 'headset', position: { x: -0.3, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await wait(2500);
s = run('tools/state.mjs');
check('it waits for your hand (no snapping back to a default spot)', s.debug.phase !== 'placed', s.debug.phase);
xr('set-transform', { device: HAND, position: { x: -0.25, y: 0.8, z: -0.33 }, orientation: FLAT });
await wait(2600);
s = run('tools/state.mjs');
const after = s.debug.loomOrigin;
check('it unfolds in front of you, where the hand rests', s.debug.phase === 'placed' && after && Math.abs(after[0] - before[0]) > 0.2, JSON.stringify({ before, after, phase: s.debug.phase }));
check('the same picture is still on it', s.debug.level === level, `${level} → ${s.debug.level}`);
done('move');
