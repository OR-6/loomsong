// E2E: in the Sea's Boat, poking a swap spool by a perch changes Pip's yarn.
import { run, wait, freshSession, setTable, calibrate, poke, check, done, cli, xr } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-sea-boat.mjs');
await wait(700);
const cal = await calibrate();
let w = run('tools/swap-where.mjs');
check('the Boat has swap spools', !!w.spots && w.level === 'boat', JSON.stringify(w));
check('Pip starts with cream yarn', w.weft === 0);
await poke(cal, w.spots[0]);
w = run('tools/swap-where.mjs');
check('poking a spool swaps to the water yarn', w.weft === 1, JSON.stringify(w));
if (process.argv[2]) {
  const p = w.spots[0];
  xr('set-transform', { device: 'hand-right', position: { x: p[0] + 0.3, y: p[1] + 0.3, z: p[2] + 0.3 } });
  xr('set-device-state', { state: { fov: 40 } });
  xr('set-transform', { device: 'headset', position: { x: p[0] + 0.06, y: p[1] + 0.16, z: p[2] + 0.24 } });
  xr('look-at', { device: 'headset', target: { x: p[0] + 0.05, y: p[1], z: p[2] } });
  await wait(400);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
done('sea swap');
