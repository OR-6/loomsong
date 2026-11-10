// Weaves the current level up to its last row, then throws the last row and
// returns at once (so a capture can catch the win payoff). Capture helper.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    c.releaseAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    const pick = (row) => { for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m === row) return s; } return 0; };
    for (let r = g.model.rows.length; r < lv.target.length; r++) {
      const s = pick(lv.target[r]);
      for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k);
      c.throwShuttle();
      if (r === lv.target.length - 1) return { level: lv.id, lastThrown: true };
      for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await sleep(100);
      await sleep(200);
    }
    return { level: lv.id };
  });
}
