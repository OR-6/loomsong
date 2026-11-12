#!/usr/bin/env node
// E2E: a tangled cloth. Night's Owl arrives woven four rows up, one of them wrong (marked on the card);
// a notice says what to do; poking the spool unpicks one row at a time down to the wrong one (the right
// rows above it come off too); then it weaves on to a win as usual.
import { run, wait, freshSession, setTable, calibrate, poke, state, check, done } from './e2e-lib.mjs';

await freshSession();
await setTable();
let m = run('tools/seed-owl-tangled.mjs');
const wrong = m.rows.findIndex((r, i) => r !== m.target[i]);
check('the Owl arrives tangled: four rows woven, one wrong (not the top one)', m.id === 'owl' && m.rows.length === 4 && wrong >= 0 && wrong < 3 && m.rows.filter((r, i) => r !== m.target[i]).length === 1, JSON.stringify(m));
await wait(2200);
const notices = state().debug.notices ?? [];
check('a notice says what to do', notices.some((n) => /tangled/i.test(n)), JSON.stringify(notices.slice(-2)));
const cal = await calibrate();
for (let k = 0; k < 4 - wrong; k++) {
  await poke(cal, state().targets.bobbin);
  await wait(1000); // the spool's quiet time after an unpick
}
let s = state();
check('poking the spool unpicks down to the wrong row', s.debug.rows.length === wrong && s.debug.rows.every((r, i) => r === m.target[i]), JSON.stringify(s.debug.rows));
run('tools/solve-nowait.mjs');
await wait(4000);
s = state();
check('then it weaves on to a win', s.debug.flow !== 'play' || s.debug.level !== 'owl', `${s.debug.flow} ${s.debug.level}`);
done('mend');
