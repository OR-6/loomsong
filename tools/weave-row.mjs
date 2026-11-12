// Weaves the next row correctly (the levers that make it, then Pip across): E2E helper.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const lv = g.flow.level;
    const c = g.controller;
    const r = g.model.rows.length;
    const want = lv.target[r] & 255;
    const n = lv.tieUp.length;
    const extra = g.model.helper ?? 0;
    for (let s = 0; s < 1 << n; s++) {
      let m = extra;
      for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k];
      if (m !== want) continue;
      for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k);
      g.model.setWeft?.(lv.target[r] & 256 ? 1 : 0);
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await new Promise((q) => setTimeout(q, 100));
      return g.model.rows.length;
    }
    return -1;
  });
}
