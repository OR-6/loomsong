#!/usr/bin/env node
/**
 * Emulator E2E (M1): first run of Level 1 with hands only, to a 3-star win,
 * including the tutorial hints, a wrong pass undone with the bobbin, a poke,
 * the cloth playback melody, and the advance to Level 2.
 */
import { calibrate, check, done, freshSession, pinchSlide, poke, setTable, shot, state, wait } from './e2e-lib.mjs';

await freshSession();
let s = await setTable();
check('loom placed', s.debug.phase === 'placed', `source=${s.debug.deskSource}`);
check('level 1 loaded (Sprout)', s.debug.level === 'sprout' && s.debug.levelIndex === 0, s.debug.level);
check('tutorial hint: lever', s.debug.hint === 'lever', s.debug.hint);
const cal = await calibrate();
shot('m1-01-start', s.debug.loomOrigin);

const T = () => state().targets;
const lever = (k, latched) => {
  const t = T();
  const p = t[`lever${k}`];
  return [p[0], p[1], latched ? t.leverLatchedZRef[2] : p[2]];
};
const restZ = (k) => {
  // rest position = latched ref + travel toward the user (+0.05 in loom z)
  const t = T();
  return [t[`lever${k}`][0], t[`lever${k}`][1], t.leverLatchedZRef[2] + 0.05];
};
const passTo = async (sideMax) => {
  const t = T();
  const a = t.shuttle;
  const b = sideMax ? t.shuttleMax : t.shuttleMin;
  const over = [b[0] + (b[0] - a[0]) * 0.08, b[1], b[2] + (b[2] - a[2]) * 0.08];
  await pinchSlide(cal, a, over, 0.9);
};

// Level 1 is the Sprout: two stem rows on lever 0, then the top row is stem AND leaves:
// lever 1 joins lever 0 ("Two levers at once!").
// Row 1: latch lever 0, pass →
const l0 = lever(0, false);
await pinchSlide(cal, l0, [l0[0], l0[1], T().leverLatchedZRef[2] - 0.005]);
s = state();
check('lever 0 latched', s.debug.latched[0] === true);
check('tutorial hint: shuttle', s.debug.hint === 'shuttle', s.debug.hint);
await passTo(true);
s = state();
check('row 1 woven', s.debug.rows.length >= 1 && s.debug.rows[0] === 24, JSON.stringify(s.debug.rows));
check('tutorial: no homework tags, the guide goes on to the next move', s.debug.hint !== 'card' && s.debug.hint !== 'knots', s.debug.hint);
shot('m1-02-row1', s.debug.loomOrigin);

// Row 2: the stem again, ← (the first picture: you do every pass yourself, Pip never does it for you)
await wait(1200);
check('the first picture: Pip waits for you, even on a repeated row', state().debug.rows.length === 1 && !state().debug.repeats, JSON.stringify(state().debug.rows));
await passTo(false);
// A deliberate wrong pass (the top row needs the leaves too): Pip droops, then the loom unpicks it by itself.
const undone0 = state().debug.autoUndo ?? 0;
await passTo(true);
shot('m1-03-miss', state().debug.loomOrigin);
for (let i = 0; i < 12 && (state().debug.autoUndo ?? 0) === undone0; i++) await wait(400);
s = state();
check('a wrong row unweaves itself (no spool fight)', (s.debug.autoUndo ?? 0) === undone0 + 1 && s.debug.rows.length === 2, JSON.stringify({ undone: s.debug.autoUndo, rows: s.debug.rows }));

// Row 3: poke lever 1 (accessibility path): it joins lever 0, the aha; pass →
await poke(cal, lever(1, false));
s = state();
check('poke latches lever 1 beside lever 0', s.debug.latched[0] === true && s.debug.latched[1] === true, JSON.stringify(s.debug.latched));
check('the aha: two levers at once', s.debug.hint === 'combo', s.debug.hint);
await passTo(true);
s = state();
check('level 1 won with 3 stars', s.debug.flow !== 'play' && s.debug.stars === 3, `flow=${s.debug.flow} stars=${s.debug.stars} rows=${JSON.stringify(s.debug.rows)}`);
shot('m1-04-win', s.debug.loomOrigin);

// Playback, the plush, then the Tulip.
await wait(8000);
s = state();
check('advanced to level 2 (Tulip)', s.debug.level === 'tulip' && s.debug.flow === 'play', `${s.debug.level} ${s.debug.flow}`);
check('level 2 has 3 levers, fresh cloth', s.debug.rows.length === 0 && s.targets.lever2 !== undefined);
shot('m1-05-level2', s.debug.loomOrigin);
done('E2E M1');
