// Game-feel smoke: weave a wrong row then undo, sampling the new-row animation, the undo nudge and Pip's glide (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const v = g.view;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const errors = [];
    const onErr = (e) => errors.push(String(e.message ?? e));
    window.addEventListener('error', onErr);
    c.releaseAll();
    const lv = g.flow.level;
    const r = g.model.rows.length;
    // a wrong row: lift the lever set whose mask is NOT the target
    const n = lv.tieUp.length;
    for (let s = 1; s < 1 << n; s++) {
      let m = 0;
      for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k];
      if (m !== lv.target[r]) { for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); break; }
    }
    await sleep(300);
    c.throwShuttle();
    for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await sleep(50);
    const s1 = { rowFxT: v.rowFxT, good: v.rowFxGood, undoNudge: +v.undoNudge.toFixed(2) };
    await sleep(600);
    const s2 = { rowFxT: v.rowFxT, undoNudge: +v.undoNudge.toFixed(2) };
    const tBefore = v.shuttleT;
    c.doUndo();
    await sleep(80);
    const mid = v.shuttleT;
    await sleep(500);
    window.removeEventListener('error', onErr);
    return { s1, s2, glide: { before: +tBefore.toFixed(2), mid: +mid.toFixed(2), after: +v.shuttleT.toFixed(2) }, rows: g.model.rows.length, errors };
  });
}
