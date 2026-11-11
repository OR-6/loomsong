#!/usr/bin/env node
/**
 * Phone-caller E2E: the managed tab hosts in XR; a phone-sized second tab joins
 * the code as the caller. The picture leaves the headset; the phone has it and
 * no lever buttons. A tap on a square pins that thread in the headset, Ring Pip
 * reaches the headset, and a finished picture leaves a postcard on the phone.
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
check('the caller sees the picture and Ring Pip, and no lever buttons', p.card && p.ring && p.levers === 0, JSON.stringify(p));
await wait(800);
a = A('state');
check('the headset knows a caller joined', a.coop === 'host+caller', a.coop);
check('the picture leaves the headset (card secret, no ghost): the caller must describe it', a.secret === true && a.ghostHidden === true, JSON.stringify({ secret: a.secret, ghost: a.ghostHidden }));
p = P('tap');
await wait(400);
a = A('state');
check("a tap on the phone's square pins that thread in the headset", a.pinned === 1 << 3, String(a.pinned));
p = P('ring');
a = A('state');
check('Ring Pip reaches the headset', /hello/.test(a.notice ?? ''), a.notice);
if (process.argv[2]) P('shot', { SHOT: process.argv[2] });
a = A('solve');
await wait(1500);
a = A('state');
check('pins come out once their row is woven', a.pinned === 0, String(a.pinned));
p = P('state');
check('a finished picture leaves the caller a postcard', p.postcard === true && p.album >= 1, JSON.stringify(p));
if (process.argv[3]) P('shot', { SHOT: process.argv[3] });
P('closecard');
P('leave');
done('E2E caller');
