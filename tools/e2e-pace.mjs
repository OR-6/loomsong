#!/usr/bin/env node
// E2E: your pace and your toolkit. A pinch after the plush pops skips the rest of a win; poking a shelf plush
// again while it sings (and once more to confirm) weaves that picture again; once Night is woven the cushion
// stays out and any plush seated on it lifts its feet's threads; the Sea's tide shows two rows at a time; the
// in-headset settings include the lever side and Fit to my hands.
import { execFileSync } from 'node:child_process';
import { run, wait, xr, freshSession, setTable, check, done, HAND } from './e2e-lib.mjs';
const P = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/pace-state.mjs'], { encoding: 'utf8', env: { ...process.env, PACE_ACTION: action } })).data.result;

await freshSession();
await setTable();
// 1. a win, skipped with a pinch once the plush is out
run('tools/seed-midgame.mjs'); // the Duck
run('tools/solve-nowait.mjs');
await wait(1600); // the plush pops
xr('set-select-value', { device: HAND, value: 1 });
await wait(300);
xr('set-select-value', { device: HAND, value: 0 });
await wait(1200);
let p = P('state');
check('a pinch after the plush pops skips the rest of the win', p.winSkips >= 1 && p.level === 'table' && p.phase === 'play', JSON.stringify(p));
// 2. weave a shelf picture again (on a picture without a cushion: there a poke seats the plush instead)
run('tools/seed-home-two.mjs'); // the House, the Heart on Home's shelf
await wait(800);
p = P('again');
check('poked again while it sings (and confirmed): that picture again', p.again !== '' && p.level === p.again && p.rows === 0, JSON.stringify(p));
// 3. the toolkit: after Night the cushion stays out; any plush on it lifts its feet's threads
run('tools/seed-all-but-boat.mjs');
await wait(800);
p = P('state');
check('after Night the cushion stays out on a picture with no friend', p.level === 'boat' && p.cushion && p.cushionOut, JSON.stringify(p));
check('the Sea: the tide shows the card two rows at a time', p.tideFrom === p.rows + 2, JSON.stringify(p));
p = P('seat');
check('a seated plush lifts the threads under its feet', p.helper > 0, JSON.stringify(p));
// 4. the in-headset settings
check('settings include the lever side and Fit to my hands', p.settings.some((t) => /^Levers:/.test(t)) && p.settings.includes('Fit to my hands'), JSON.stringify(p.settings));
done('pace');
