#!/usr/bin/env node
/**
 * Co-op E2E: two tabs in one emulator browser, a real PeerJS connection.
 * A (managed, in XR, hands) hosts and works the levers; B joins and throws
 * the shuttle. Needs internet (PeerJS public broker).
 */
import { execFileSync } from 'node:child_process';
import { check, done, freshSession, setTable, wait } from './e2e-lib.mjs';

const runWith = (script, env = {}) =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', script], { encoding: 'utf8', env: { ...process.env, ...env } })).data.result;
const A = (action) => runWith('tools/coop-a.mjs', { COOP_ACTION: action });
const B = (action, code) => runWith('tools/coop-b.mjs', { COOP_ACTION: action, COOP_CODE: code ?? '' });

await freshSession();
await setTable();
let a = A('host');
check('host gets a 4-letter room code', a.status.state === 'hosting' && /^[CDFHJKMNPRTVWXY]{4}$/.test(a.status.code ?? ''), JSON.stringify(a.status));
const code = a.status.code;

let b = B('state');
B('clear');
await wait(3000);
b = B('join', code);
check('guest connects with the code', b.status.state === 'connected' && b.status.role === 'guest', JSON.stringify(b.status));
b = B('enter');
check('guest enters XR and auto-places (?desk)', b.phase === 'placed', b.phase);
await wait(800);
a = A('state');
b = B('state');
check('roles assigned', a.coop === 'host' && b.coop === 'guest', `${a.coop}/${b.coop}`);
check('guest mirrors the host level', b.level === a.level, `${a.level} vs ${b.level}`);
check('guest sees its role notice', b.notices.includes('You slide Pip; they push levers'), JSON.stringify(b.notices)); // its tab may also be asked to put controllers down

A('lever0');
await wait(600);
b = B('state');
check('host lever reaches the guest', b.latched[0] === true, JSON.stringify(b.latched));

b = B('drag');
await wait(500);
a = A('state');
b = B('state');
check('guest shuttle drag weaves a row on the host', a.rows.length === 1, JSON.stringify(a.rows));
check('row mirrored back to the guest', JSON.stringify(b.rows) === JSON.stringify(a.rows), `${JSON.stringify(a.rows)} vs ${JSON.stringify(b.rows)}`);

B('throw');
await wait(400);
a = A('state');
check('guest throw request weaves on the host', a.rows.length === 2, JSON.stringify(a.rows));
B('undo');
await wait(400);
a = A('state');
b = B('state');
check('guest undo request unpicks on both', a.rows.length === 1 && b.rows.length === 1, `${a.rows.length}/${b.rows.length}`);

B('leave');
await wait(1500);
a = A('state');
check('host notices the guest left and returns to solo', a.coop === 'solo' && a.status.state === 'closed', `${a.coop} ${JSON.stringify(a.status)}`);
done('E2E co-op');
