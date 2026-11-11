#!/usr/bin/env node
// E2E: call a friend from inside the headset. No telephone in the first minutes; after the first
// picture a toy telephone sits on the desk; a poke hosts a loom and its tag shows the code; a phone
// joins as the caller and the tag says so; a second poke hangs up. Needs internet (PeerJS broker).
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable, calibrate, poke, check, done } from './e2e-lib.mjs';
const P = (action, extra = {}) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/coop-caller.mjs'], { encoding: 'utf8', env: { ...process.env, COOP_ACTION: action, ...extra } })).data.result;
await freshSession();
await setTable();
let w = run('tools/phone-where.mjs');
check('no telephone during the first picture', !w.visible && !w.phone, JSON.stringify(w));
run('tools/seed-sprout-done.mjs');
await wait(600);
w = run('tools/phone-where.mjs');
check('after the first picture a toy telephone sits on the desk', w.visible && !!w.phone && w.tag === 'Call a friend', JSON.stringify(w));
const cal = await calibrate();
await poke(cal, w.phone);
for (let i = 0; i < 20 && !/^Code [CDFHJKMNPRTVWXY]{4}$/.test(run('tools/phone-where.mjs').tag); i++) await wait(500);
w = run('tools/phone-where.mjs');
check('a poke hosts a loom: the tag shows the code to read out', w.state === 'calling' && /^Code [CDFHJKMNPRTVWXY]{4}$/.test(w.tag) && w.coop.state === 'hosting', JSON.stringify(w));
const code = w.tag.slice(5);
const p = P('call', { COOP_CODE: code });
check('a phone joins with that code', p.status.state === 'connected' && p.status.role === 'caller', JSON.stringify(p.status));
await wait(800);
w = run('tools/phone-where.mjs');
check('the tag says the caller is here', w.state === 'connected' && w.tag === 'Caller is here', JSON.stringify(w));
await poke(cal, w.phone);
await wait(800);
w = run('tools/phone-where.mjs');
check('a second poke hangs up', w.state === 'idle' && w.tag === 'Call a friend' && w.coop.state !== 'connected', JSON.stringify(w));
P('leave');
done('phone');
