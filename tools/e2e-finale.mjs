// E2E: finishing the last Garden picture plays the chapter finale (shelf medley + 'Garden complete!') before the next chapter.
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable, check, done, cli, xr, state } from './e2e-lib.mjs';
const F = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/friend-state.mjs'], { encoding: 'utf8', env: { ...process.env, FRIEND_ACTION: action, FRIEND_LEVEL: 'table', FRIEND_ID: 'sprout' } })).data.result;
await freshSession();
await setTable();
let s = F('seed'); // Garden 3/4 done, the Table (its last picture) loaded
let f = run('tools/finale-state.mjs');
check('the Table is the last Garden picture', f.level === 'table', JSON.stringify(f));
// weave it, seating the Sprout when a row needs a friend and lifting it off when one doesn't
for (let r = 0; r < 6 && s.phase === 'play'; r++) {
  s = F('state');
  if (s.hint === 'friendOn') F('poke');
  if (s.hint === 'friendOff') F('poke');
  s = F('row');
}
let seen = null;
for (let i = 0; i < 40 && !seen; i++) {
  await wait(400);
  f = run('tools/finale-state.mjs');
  if (f.notice === 'Garden complete!') seen = f;
}
check("'Garden complete!' shows", !!seen, JSON.stringify(f));
check('the shelf plays its medley', !!seen && seen.singing, JSON.stringify(seen));
check('still on the Table while it plays', !!seen && seen.level === 'table', JSON.stringify(seen));
if (process.argv[2] && seen) {
  const O = state().debug.loomOrigin;
  xr('set-device-state', { state: { fov: 70 } });
  xr('set-transform', { device: 'headset', position: { x: O[0] - 0.1, y: O[1] + 0.4, z: O[2] + 0.36 } });
  xr('look-at', { device: 'headset', target: { x: O[0] - 0.12, y: O[1], z: O[2] - 0.03 } });
  await wait(600);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
for (let i = 0; i < 40; i++) { await wait(500); f = run('tools/finale-state.mjs'); if (f.level !== 'table') break; }
check('then the next chapter begins', f.level !== 'table', JSON.stringify(f));
// the Garden's pictures, sewn into a quilt, fly to the wall ahead
let q = run('tools/quilt-where.mjs');
for (let i = 0; i < 12 && !q.quilts.garden; i++) { await wait(500); q = run('tools/quilt-where.mjs'); }
check('the Garden quilt flew to the wall', !!q.quilts.garden && !q.flying, JSON.stringify(q));
done('chapter finale');
