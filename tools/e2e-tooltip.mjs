// E2E: hovering a hand over the shelf's wind-up key shows the 'Play the shelf' tooltip.
import { run, wait, freshSession, setTable, check, done, cli, xr, HAND, FLAT } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-midgame.mjs');
await wait(700);
// the open hand's pinch point (thumb–index midpoint) is what hovers
const P = [0.05, 1.0, -0.33];
xr('set-select-value', { device: HAND, value: 0 });
xr('set-transform', { device: HAND, position: { x: P[0], y: P[1], z: P[2] }, orientation: FLAT });
await wait(400);
const pp = run('tools/state.mjs').right.pinchPoint;
const off = pp.map((v, i) => v - P[i]);
const k = run('tools/key-where.mjs').key;
xr('set-transform', { device: HAND, position: { x: k[0] - off[0], y: k[1] + 0.006 - off[1], z: k[2] - off[2] }, orientation: FLAT });
await wait(900);
const tip = run('tools/tip-state.mjs');
check('hovering the key shows its tooltip', tip.visible && tip.text === 'Play the shelf', JSON.stringify(tip));
if (process.argv[2]) {
  xr('set-device-state', { state: { fov: 45 } });
  xr('set-transform', { device: 'headset', position: { x: k[0] + 0.1, y: k[1] + 0.2, z: k[2] + 0.3 } });
  xr('look-at', { device: 'headset', target: { x: k[0] + 0.12, y: k[1] + 0.02, z: k[2] } });
  await wait(400);
  cli('browser', 'screenshot', '--output-file', process.argv[2]);
}
done('tooltip');
