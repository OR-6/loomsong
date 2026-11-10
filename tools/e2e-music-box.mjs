// E2E: poking the shelf's wind-up key plays every finished plush in turn.
import { run, wait, freshSession, setTable, calibrate, poke, check, done, cli, xr } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-midgame.mjs');
await wait(800);
const cal = await calibrate();
let w = run('tools/key-where.mjs');
check('the key is touchable', !!w.key, JSON.stringify(w.key));
const before = w.time;
await poke(cal, w.key);
w = run('tools/key-where.mjs');
const singing = w.left.filter((x) => x > 0).length;
check('the key started a medley', w.singUntil > before + 3, `until ${w.singUntil.toFixed(2)} from ${before.toFixed(2)}`);
check('several plushes are queued in turn', singing >= 2 && w.waits.some((x) => x > 0.5), JSON.stringify(w));
if (process.argv[2]) {
  const p = w.key;
  xr('set-transform', { device: 'hand-right', position: { x: p[0] + 0.3, y: p[1] + 0.3, z: p[2] + 0.3 } });
  xr('set-device-state', { state: { fov: 45 } });
  xr('set-transform', { device: 'headset', position: { x: p[0] + 0.12, y: p[1] + 0.2, z: p[2] + 0.28 } });
  xr('look-at', { device: 'headset', target: { x: p[0] + 0.1, y: p[1], z: p[2] } });
  await wait(400);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
done('music box');
