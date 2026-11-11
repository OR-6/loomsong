// Plays the rest of the current level for the clip: weave the remaining rows with pauses, then the win runs on its own.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    await sleep(600);
    for (let r = g.model.rows.length; r < lv.target.length; r++) {
      let best = -1, bf = 99;
      for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m !== (lv.target[r] & 255)) continue; let f = 0; for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) f++; if (f < bf) { bf = f; best = s; } }
      for (let k = 0; k < n; k++) if (!!(best & (1 << k)) !== g.model.latched[k]) { c.toggleLever(k); await sleep(380); }
      await sleep(300);
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await sleep(60);
      await sleep(700);
    }
    return { rows: g.model.rows.length };
  });
}
