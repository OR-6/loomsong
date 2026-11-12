import { execFileSync } from 'node:child_process';
import { run, xr, wait, freshSession, setTable, cli, HAND } from '/Users/numair/Desktop/Loomsong/tools/e2e-lib.mjs';
const S = 'artifacts/finale-raw'; import('node:fs').then((fs) => fs.mkdirSync(S, { recursive: true }));
await freshSession();
await setTable();
const O = run('tools/state.mjs').debug.loomOrigin;
run('tools/photo-on.mjs');
run('tools/seed-all-but-boat.mjs');
await wait(1200);
execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/grand-go.mjs'], { encoding: 'utf8' });
xr('set-transform', { device: HAND, position: { x: O[0] + 0.9, y: O[1] + 0.6, z: O[2] + 0.9 } });
xr('set-transform', { device: 'hand-left', position: { x: O[0] - 0.9, y: O[1] + 0.6, z: O[2] + 0.9 } });
xr('set-device-state', { state: { fov: 50 } });
xr('set-transform', { device: 'headset', position: { x: O[0] + 0.03, y: O[1] + 0.27, z: O[2] + 0.5 } });
xr('look-at', { device: 'headset', target: { x: O[0] - 0.01, y: O[1] + 0.09, z: O[2] - 0.05 } });
for (const [i, ms] of [[1, 5000], [2, 3000], [3, 3000], [4, 3000], [5, 4000], [6, 4000], [7, 4000], [8, 4000], [9, 4000], [10, 4000]]) {
  await wait(ms);
  cli('browser', 'screenshot', '--output-file', `${S}/finale${i}.png`);
  console.log(i, JSON.stringify(run('tools/state.mjs').debug.grand));
}
xr('set-device-state', { state: { fov: 90 } });
process.env.PHOTO = '0';
run('tools/photo-on.mjs');
