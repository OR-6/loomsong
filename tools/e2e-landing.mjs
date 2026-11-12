#!/usr/bin/env node
/**
 * 2D landing-page E2E: every control exists and works (real clicks), and
 * mounting raises no page errors. Guards against half-wired UI.
 */
import { cli, run, xr, wait, check, done } from './e2e-lib.mjs';

run('tools/clear-storage.mjs');
cli('browser', 'reload');
await wait(3000);
if (xr('status').sessionActive) xr('exit');
const r = run('tools/landing-probe.mjs');
check('no page errors while mounting', r.errors.length === 0, JSON.stringify(r.errors));
check('all landing controls present', r.missing.length === 0, `missing: ${r.missing.join(', ')}`);
check('High contrast toggles the saved setting', r.hcOn === true && r.hcOff === false, `${r.hcOn}/${r.hcOff}`);
check('Fit to my hands queues calibration', r.fit === true);
check('Levers: Left saves hand=left', r.hand === 'left');
check('co-op panel opens with Host/Join', r.coopOpen === true);
check('bad room code is rejected politely', r.badCode === "Type the 4 letters on your friend's toy telephone", r.badCode);
done('E2E landing');
