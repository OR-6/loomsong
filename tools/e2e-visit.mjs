#!/usr/bin/env node
// E2E: visitors. A plush left on your desk brings a visitor: on a new day the present appears right
// beside it ("Someone came to see your Sprout"), today's pick is the visitor that likes that plush,
// and once woven the visitor plush stands where the present was, by its friend.
import { execFileSync } from 'node:child_process';
import { run, xr, wait, check, done, setTable, HAND, FLAT } from './e2e-lib.mjs';
const go = (q) => execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/goto-params.mjs'], { encoding: 'utf8', env: { ...process.env, GOTO_SEARCH: q } });
try { xr('set-transform', { device: HAND, position: { x: 0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: -90 } }); } catch {}
run('tools/clear-storage.mjs');
go('?visit=1');
await wait(4500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
xr('set-transform', { device: 'hand-left', position: { x: -0.35, y: 1.45, z: -0.25 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
await setTable();
xr('set-transform', { device: HAND, position: { x: 0.45, y: 1.3, z: 0.2 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
await wait(3000);
let v = run('tools/visit-state.mjs');
check('a plush stands on the desk', !!v.placed.sprout, JSON.stringify(v.placed));
check("today's pick is the visitor who likes it (the Ladybug)", v.pick?.id === 'day-ladybug', JSON.stringify(v.pick));
const sp = v.placed.sprout;
check('the present stands right beside the Sprout', v.giftShown && sp && Math.hypot(v.gift[0] - sp[0], v.gift[1] - sp[1]) < 0.1, JSON.stringify({ gift: v.gift, sprout: sp }));
check('a notice says someone came to see it', v.notices.some((n) => /came to see your Sprout/.test(n)), JSON.stringify(v.notices));
go('');
await wait(4000);
done('visit');
