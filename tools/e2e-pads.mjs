#!/usr/bin/env node
// E2E: picking up controllers. The game is played with bare hands; holding controllers, the table
// prompt says to put them down, and once the loom is out a notice says it; back to hands, it stops.
import { run, xr, wait, freshSession, check, done } from './e2e-lib.mjs';
await freshSession();
xr('set-input-mode', { mode: 'controller' });
await wait(1500);
let s = run('tools/state.mjs');
check('controllers are noticed', s.debug.controllers === true, String(s.debug.controllers));
const hint = run('tools/hint-text.mjs');
check('the table prompt asks to put them down', hint === 'Put the controllers down', hint);
// without a resting palm the loom unfolds at a default height after a few seconds
for (let i = 0; i < 20 && run('tools/state.mjs').debug.phase !== 'placed'; i++) await wait(500);
await wait(800);
s = run('tools/state.mjs');
check('once the loom is out, a notice says it too', (s.debug.notices ?? []).includes('Put the controllers down: play with your hands'), JSON.stringify(s.debug.notices));
xr('set-input-mode', { mode: 'hand' });
await wait(1000);
s = run('tools/state.mjs');
check('hands again: no more nagging', s.debug.controllers === false, String(s.debug.controllers));
done('controllers');
