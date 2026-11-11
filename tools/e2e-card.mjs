// E2E: the card sings. Poke a row of the picture card and it plays that row's tune.
import { run, xr, wait, freshSession, setTable, calibrate, check, done, HAND, FLAT } from './e2e-lib.mjs';
await freshSession();
await setTable();
await wait(800);
let w = run('tools/card-where.mjs');
const r = w.rows.findIndex((x) => x);
check('the card rows are pokeable', r >= 0, JSON.stringify(w.rows));
const cal = await calibrate();
// a forward poke into the upright card (the way a hand pokes a card on a stand)
const p = w.rows[0];
const at = (dz) => ({ x: p[0] - cal.indexOff[0], y: p[1] - cal.indexOff[1], z: p[2] + dz - cal.indexOff[2] });
xr('set-select-value', { device: HAND, value: 0 });
xr('set-transform', { device: HAND, position: at(0.08), orientation: FLAT });
await wait(400);
xr('animate-to', { device: HAND, position: at(0.002), duration: 0.2 });
await wait(450);
xr('animate-to', { device: HAND, position: at(0.09), duration: 0.2 });
await wait(400);
w = run('tools/card-where.mjs');
check('poking the bottom row plays it', w.played === 0, JSON.stringify(w.played));
done('card sings');
