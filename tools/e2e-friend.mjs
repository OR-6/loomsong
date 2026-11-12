#!/usr/bin/env node
// E2E: a friend picture (Table). The cushion shows; the legs weave without a friend; then the game
// asks for one; a plush seated on the cushion lifts the threads under its feet; lifting it off drops
// them again; the picture finishes with the friend's help and the friend goes home after.
import { execFileSync } from 'node:child_process';
import { wait, freshSession, setTable, check, done } from './e2e-lib.mjs';
const F = (action, level = 'table', who = 'sprout') =>
  JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/friend-state.mjs'], { encoding: 'utf8', env: { ...process.env, FRIEND_ACTION: action, FRIEND_LEVEL: level, FRIEND_ID: who } })).data.result;
await freshSession();
await setTable();
await wait(1000);
let s = F('seed');
check('the Table is up, with a cushion for a friend', s.level === 'table' && s.cushion === true && s.helper === 0, JSON.stringify(s));
check('the Sprout waits on the Garden shelf', s.heartAt >= 0 && s.heartAt < 5, String(s.heartAt));
F('row');
s = F('row');
check('the legs weave with the levers alone', s.rows === 2 && s.statuses.startsWith('ok'.repeat(1)) && !s.statuses.includes('x'), s.statuses);
check('then the game asks for a friend', s.hint === 'friendOn', s.hint);
s = F('seat');
check('a plush on the cushion lifts the threads under its feet', s.friend === 'sprout' && s.helper === 0b00011000 && (s.shed & 0b00011000) === 0b00011000, JSON.stringify(s));
check('the friend hint goes once it sits there', s.hint !== 'friendOn', s.hint);
s = F('unseat');
check('lifting it off drops its threads', s.helper === 0 && s.friend === '' && s.heartAt >= 0 && s.heartAt < 5, JSON.stringify(s));
s = F('poke');
check('a poke seats it too, with felt strings to its threads', s.friend === 'sprout' && s.helper === 0b00011000 && s.strings === 2, JSON.stringify(s));
s = F('poke');
check('a second poke sends it home', s.friend === '' && s.helper === 0 && s.strings === 0 && s.heartAt >= 0 && s.heartAt < 5, JSON.stringify(s));
s = F('poke');
for (let r = 0; r < 3 && s.phase === 'play'; r++) s = F('row');
check('with the friend, the tabletop, vase and flower weave right', !s.statuses.includes('x') && s.phase !== 'play', `${s.statuses} ${s.phase}`);
for (let i = 0; i < 30 && F('state').level === 'table'; i++) await wait(1000);
s = F('state');
check('the friend is thanked', s.notices.includes('Thanks, Sprout!'), JSON.stringify(s.notices));
check('next picture: the cushion goes and the friend is back home', s.level !== 'table' && s.cushion === false && s.helper === 0, JSON.stringify(s));
// the Lantern (Night): the friend must come from the Night shelf; the Moon's feet don't fit, the Owl's do
s = F('seed', 'lantern', 'moon');
check('the Lantern is up with a cushion', s.level === 'lantern' && s.cushion === true, JSON.stringify(s));
check('its wide stand asks for a friend straight away', s.hint === 'friendOn' && s.rows === 0, JSON.stringify(s));
s = F('seat', 'lantern', 'moon');
check("the Moon's feet are wrong for it: try other feet", s.friend === 'moon' && s.hint === 'friendSwap', JSON.stringify(s));
F('unseat', 'lantern', 'moon');
s = F('seat', 'lantern', 'owl');
check('the Owl fits', s.friend === 'owl' && s.hint !== 'friendSwap' && s.hint !== 'friendOn', JSON.stringify(s));
for (let r = 0; r < 6 && s.phase === 'play'; r++) {
  s = F('state', 'lantern', 'owl');
  if (s.hint === 'friendOff') s = F('unseat', 'lantern', 'owl');
  if (s.hint === 'friendOn') s = F('seat', 'lantern', 'owl');
  s = F('row', 'lantern', 'owl');
}
check('on and off the cushion, the Lantern weaves right', !s.statuses.includes('x') && s.phase !== 'play', `${s.statuses} ${s.phase}`);
done('friend');
