// E2E: pinch a finished plush off the shelf, carry it, and set it down on the desk.
// It stays (saved), survives a reload, sings in the wind-up medley, refuses the loom,
// and goes back to the shelf when set down there.
import { cli, run, wait, freshSession, setTable, calibrate, pinchSlide, poke, check, done } from './e2e-lib.mjs';
await freshSession();
await setTable();
run('tools/seed-midgame.mjs');
await wait(900);
const cal = await calibrate();
let w = run('tools/desk-where.mjs');
const i = w.spots.findIndex((s, k) => s && k < 5);
check('a shelf plush can be pinched', i >= 0, JSON.stringify(w.ids));
const id = w.ids[i];
await pinchSlide(cal, w.spots[i], w.desk, 0.9);
await wait(700);
w = run('tools/desk-where.mjs');
check('set down on the desk', w.lastDrop.startsWith('desk'), w.lastDrop);
check('it left the shelf for a desk spot', w.ids[i] === null && w.ids.slice(5).includes(id), JSON.stringify(w.ids));
check('its place is saved', !!w.saved?.[id], JSON.stringify(w.saved));
check('nothing is still carried', w.carried === -1);
check('the first one says it lives on the desk', w.notice === 'It lives on your desk now', w.notice);
const d = w.ids.indexOf(id, 5);
const deskSpot = w.spots[d];
check('it stands on the desk where it was let go', !!deskSpot && Math.hypot(deskSpot[0] - w.desk[0], deskSpot[2] - w.desk[2]) < 0.03, JSON.stringify([deskSpot, w.desk]));

// carry it into the loom: refused, it hops back to its desk spot
await pinchSlide(cal, deskSpot, w.inLoom, 0.6);
await wait(700);
w = run('tools/desk-where.mjs');
check('the loom is not a place for it', w.lastDrop === 'back' && w.ids[d] === id, w.lastDrop);

// a reload keeps it on the desk
await freshSession({ clear: false });
await setTable();
// the shelf and desk are rebuilt with the first picture: wait for them rather than a fixed time
w = run('tools/desk-where.mjs');
for (let i = 0; i < 20 && !w.ids.some(Boolean); i++) {
  // a slow reload can miss the first palm: rest it again if the loom isn't out yet
  if (i % 5 === 4 && run('tools/state.mjs').debug.phase !== 'placed') await setTable();
  await wait(300);
  w = run('tools/desk-where.mjs');
}
check('after a reload it is still on the desk', w.ids.includes(id) && w.ids.indexOf(id) >= 5, JSON.stringify({ ids: w.ids, phase: run('tools/state.mjs').debug.phase }));

// the wind-up key plays it with the shelf
const cal2 = await calibrate();
await poke(cal2, run('tools/key-where.mjs').key);
w = run('tools/desk-where.mjs');
check('the medley plays (desk plush included)', w.singUntil > w.time + 1, `${w.time} → ${w.singUntil}`);
await wait(Math.max(0, (w.singUntil - w.time) * 1000) + 300);

// back onto its shelf slot
w = run('tools/desk-where.mjs');
const d2 = w.ids.indexOf(id);
await pinchSlide(cal2, w.spots[d2], w.shelf[i], 0.9);
await wait(700);
w = run('tools/desk-where.mjs');
check('set back on the shelf', w.lastDrop === 'shelf' && w.ids.indexOf(id) < 5, `${w.lastDrop} ${JSON.stringify(w.ids)}`);
check('no longer saved on the desk', !w.saved?.[id], JSON.stringify(w.saved));
void cli;
done('desk plush');
