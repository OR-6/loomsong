#!/usr/bin/env node
// E2E: weave a row by ear. In Home one row is a felt patch on the card; when it comes up Pip hums it
// (no lever hint gives it away); weaving it right takes the patch off with "By ear!".
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
const weave = () => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/weave-row.mjs'], { encoding: 'utf8' })).data.result;
await freshSession();
await setTable();
run('tools/seed-home-two.mjs');
await wait(1200);
let e = run('tools/ear-state.mjs');
check('a Home picture has a row to weave by ear', e.earRow > 0 && e.patch === e.earRow, JSON.stringify(e));
check('Garden has none (checked on load of Home only)', e.level === 'house', e.level);
for (let i = 0; i < 10 && run('tools/ear-state.mjs').rows < e.earRow; i++) {
  weave();
  await wait(1200);
}
await wait(1500);
e = run('tools/ear-state.mjs');
check('when it comes up Pip hums it', e.rows === e.earRow && e.hums >= 1, JSON.stringify(e));
const notices = run('tools/state.mjs').debug.notices ?? [];
check('a notice says to listen (no lever hint gives it away)', notices.some((n) => /Pip hums it/.test(n)) && !/lever \d/.test(e.tag), JSON.stringify({ notices: notices.slice(-2), tag: e.tag }));
weave();
await wait(1500);
e = run('tools/ear-state.mjs');
check('woven right: "By ear!" and the patch comes off', e.result === 'by ear' && e.patch === -1 && !/patch/.test(e.tag), JSON.stringify(e));
done('ear');
