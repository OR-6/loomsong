#!/usr/bin/env node
/**
 * Phone-caller E2E: the managed tab hosts in XR; a phone-sized second tab joins
 * the code as the caller and presses a lever button; the headset's lever lifts.
 * Needs internet (PeerJS public broker).
 */
import { execFileSync } from 'node:child_process';
import { check, done, freshSession, setTable, wait } from './e2e-lib.mjs';

const runWith = (script, env = {}) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', script], { encoding: 'utf8', env: { ...process.env, ...env } })).data.result;
const A = (action) => runWith('tools/coop-a.mjs', { COOP_ACTION: action });
const P = (action, extra = {}) => runWith('tools/coop-caller.mjs', { COOP_ACTION: action, ...extra });

await freshSession();
await setTable();
let a = A('host');
const code = a.status.code;
check('host gets a room code', /^[CDFHJKMNPRTVWXY]{4}$/.test(code ?? ''), JSON.stringify(a.status));
let p = P('call', { COOP_CODE: code });
check('the phone joins as the caller', p.status.state === 'connected' && p.status.role === 'caller', JSON.stringify(p.status));
check('the caller sees the card and lever buttons', p.view && p.levers.length >= 2, JSON.stringify(p));
await wait(800);
a = A('state');
check('the headset knows a caller joined', a.coop === 'host+caller', a.coop);
check('the picture leaves the headset (card secret, no ghost): the caller must describe it', a.secret === true && a.ghostHidden === true, JSON.stringify({ secret: a.secret, ghost: a.ghostHidden }));
p = P('press0');
await wait(500);
a = A('state');
check("the caller's press lifts the headset's lever", a.latched[0] === true, JSON.stringify(a.latched));
p = P('state');
check('the phone shows that lever pressed', p.levers[0]?.endsWith(':true'), JSON.stringify(p.levers));
if (process.argv[2]) P('shot', { SHOT: process.argv[2] });
P('leave');
done('E2E caller');
