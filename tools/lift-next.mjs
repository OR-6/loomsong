// Lifts the levers for the next row without weaving (capture helper: shed open, shuttle tutorial step).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    const r = g.model.rows.length;
    for (let s = 0; s < 1 << n; s++) {
      let m = 0;
      for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k];
      if (m === (lv.target[r] & 255)) { for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); break; }
    }
    await new Promise((r) => setTimeout(r, 400));
    return { latched: [...g.model.latched] };
  });
}
