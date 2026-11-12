#!/usr/bin/env node
// E2E: small delights. A new picture keeps its name a surprise ("?") until it comes alive; a wrong row
// unweaves itself after Pip's droop (not in the tutorial); plushes set down side by side say hello;
// on the second picture the ghost hand shows, once, that a plush can be carried to the desk.
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
const D = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/delight-state.mjs'], { encoding: 'utf8', env: { ...process.env, DELIGHT_ACTION: action } })).data.result;
await freshSession();
await setTable();
run('tools/seed-sprout-done.mjs'); // the second picture: the ghost hand shows carrying a plush, once
await wait(3500);
check('the ghost hand shows a plush being carried to the desk, once', run('tools/state.mjs').debug.carryDemo === true);
run('tools/seed-midgame.mjs'); // the Duck, not woven before
await wait(600);
let s = D('state');
check("a new picture's plate keeps its name a surprise", s.level === 'duck' && s.plaque === 'Garden · new picture', JSON.stringify(s));
run('tools/solve-best.mjs');
for (let i = 0; i < 10 && !s.reveal; i++) {
  await wait(300);
  s = D('state');
}
check('it is named as it comes alive, on a ribbon', s.reveal === 'Duck' && s.banner === 'Duck', JSON.stringify(s));
run('tools/seed-desk.mjs'); // Home's Heart, desk plushes out
await wait(800);
s = D('wrong');
check('a wrong row is woven', s.rows === 1, JSON.stringify(s));
await wait(2600);
s = D('state');
check('it unweaves itself after a moment', s.rows === 0 && s.autoUndo >= 1, JSON.stringify(s));
s = D('hello');
check('set down beside a friend, they say hello', s.hello >= 1 && /^desk/.test(s.lastDrop), JSON.stringify(s));
done('delight');
