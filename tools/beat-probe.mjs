// On-beat reward: waits for a beat, weaves the next row right on it, and reports whether it counted (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const a = window.__loom.audio;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    a.resume();
    c.releaseAll();
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    const r = g.model.rows.length;
    for (let s = 0; s < 1 << n; s++) {
      let m = 0;
      for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k];
      if (m === lv.target[r]) { for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); break; }
    }
    await sleep(2500); // let the music start
    const before = g.debug.onBeat ?? 0;
    // commit the row exactly as a beat lands
    for (let w = 0; w < 400; w++) { const o = a.beatOffset(); if (o !== null && o < 0.02) break; await sleep(5); }
    const off = a.beatOffset();
    g.model.commitRow();
    return { offset: off, onBeat: (g.debug.onBeat ?? 0) - before, rows: g.model.rows.length };
  });
}
