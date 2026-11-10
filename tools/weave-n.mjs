// Weaves the next two rows of the current level correctly (E2E/capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.releaseAll();
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    const start = g.model.rows.length;
    for (let r = start; r < Math.min(lv.target.length, start + 2); r++) {
      let best = -1;
      for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m === lv.target[r]) { best = s; break; } }
      for (let k = 0; k < n; k++) if (!!(best & (1 << k)) !== g.model.latched[k]) c.toggleLever(k);
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await sleep(100);
      await sleep(250);
    }
    // lift the next row's levers so the shed is open in the shot
    const r = g.model.rows.length;
    for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m === lv.target[r]) { for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); break; } }
    await sleep(500);
    return { rows: g.model.rows.length };
  });
}
