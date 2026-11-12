#!/usr/bin/env node
// E2E: a practice call. Poke the toy telephone; when no friend picks up, a practice caller does: the
// picture leaves the loom and felt pins drop, one by one, on exactly the next row's threads; weave the
// row and it pins the next one; poke the telephone to hang up and the picture comes back.
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
const P = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/practice-state.mjs'], { encoding: 'utf8', env: { ...process.env, PRACTICE_ACTION: action } })).data.result;
await freshSession();
await setTable();
run('tools/seed-desk.mjs');
await wait(1500);
let s = P('state');
check('no call yet', !s.practice && s.phone === 'idle' && !s.secret, JSON.stringify(s));
P('call');
for (let i = 0; i < 20 && !(s.practice && s.pinned === s.row); i++) {
  await wait(500);
  s = P('state');
}
check('a practice caller picks up: the picture leaves the loom', s.practice && s.secret && s.phone === 'connected', JSON.stringify(s));
check('its pins mark exactly the next row', s.row !== null && s.pinned === s.row, JSON.stringify([s.pinned, s.row]));
// weave that row (the right levers, then Pip) and the caller pins the next one
execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/weave-row.mjs'], { encoding: 'utf8' });
const rows = s.rows;
for (let i = 0; i < 24 && !(s.rows > rows && s.pinned === s.row && s.pinned); i++) {
  await wait(500);
  s = P('state');
}
check('the next row gets its own pins', s.rows > rows && s.pinned === s.row, JSON.stringify([s.rows, s.pinned, s.row]));
s = P('hangup');
await wait(300);
s = P('state');
check('hang up: pins gone, the picture is back', !s.practice && s.pinned === 0 && !s.secret && s.phone === 'idle', JSON.stringify(s));
done('practice');
