// Weaves the current level to completion through the controller (E2E helper):
// per row, latch the cheapest lever set whose OR is the target row, then throw.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    for (let r = g.model.rows.length; r < lv.target.length; r++) {
      let best = -1;
      for (let s = 0; s < 1 << n; s++) {
        let m = 0;
        for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k];
        if (m === lv.target[r] && (best < 0 || popcount(s) < popcount(best))) best = s;
      }
      if (best < 0) return { error: 'row ' + r + ' unweavable' };
      for (let k = 0; k < n; k++) if (!!(best & (1 << k)) !== g.model.latched[k]) c.toggleLever(k);
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await sleep(100);
      await sleep(250);
    }
    return { level: lv.id, rows: g.model.rows.length, phase: g.flow.phase };
    function popcount(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
  });
}
