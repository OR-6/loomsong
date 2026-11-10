// E2E: poking a finished plush on the shelf with the index finger makes it sing.
import { cli, run, xr, wait, freshSession, setTable, calibrate, poke, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-midgame.mjs');
await wait(800);
const cal = await calibrate();
let w = run('tools/plush-where.mjs');
const i = w.spots.findIndex((s) => s);
check('a finished plush is pokeable', i >= 0, JSON.stringify(w.spots));
check('nothing sings before the poke', !w.singing);
const before = w.time;
await poke(cal, w.spots[i]);
w = run('tools/plush-where.mjs');
check('the poke started its song', w.singUntil > before, `poked after t=${before.toFixed(2)}, song until ${w.singUntil.toFixed(2)}`);
if (process.argv[2]) {
  const p = w.spots[i];
  xr('set-transform', { device: 'hand-right', position: { x: p[0] + 0.2, y: p[1] + 0.3, z: p[2] + 0.3 } });
  xr('set-device-state', { state: { fov: 45 } });
  xr('set-transform', { device: 'headset', position: { x: p[0] + 0.08, y: p[1] + 0.18, z: p[2] + 0.26 } });
  xr('look-at', { device: 'headset', target: { x: p[0] + 0.04, y: p[1], z: p[2] } });
  await poke(cal, p);
  await wait(250);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
done('plush sing');
