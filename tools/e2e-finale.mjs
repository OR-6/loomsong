// E2E: finishing the last Garden picture plays the chapter finale (shelf medley + 'Garden complete!') before the next chapter.
import { run, wait, freshSession, setTable, check, done, cli, xr, state } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-midgame.mjs'); // Garden 3/4 done, the Duck loaded
await wait(800);
let f = run('tools/finale-state.mjs');
check('the Duck is the last Garden picture', f.level === 'duck', JSON.stringify(f));
run('tools/solve-nowait.mjs');
let seen = null;
for (let i = 0; i < 40 && !seen; i++) {
  await wait(400);
  f = run('tools/finale-state.mjs');
  if (f.notice === 'Garden complete!') seen = f;
}
check("'Garden complete!' shows", !!seen, JSON.stringify(f));
check('the shelf plays its medley', !!seen && seen.singing, JSON.stringify(seen));
check('still on the Duck while it plays', !!seen && seen.level === 'duck', JSON.stringify(seen));
if (process.argv[2] && seen) {
  const O = state().debug.loomOrigin;
  xr('set-device-state', { state: { fov: 70 } });
  xr('set-transform', { device: 'headset', position: { x: O[0] - 0.1, y: O[1] + 0.4, z: O[2] + 0.36 } });
  xr('look-at', { device: 'headset', target: { x: O[0] - 0.12, y: O[1], z: O[2] - 0.03 } });
  await wait(600);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
for (let i = 0; i < 40; i++) { await wait(500); f = run('tools/finale-state.mjs'); if (f.level !== 'duck') break; }
check('then the next chapter begins', f.level !== 'duck', JSON.stringify(f));
done('chapter finale');
