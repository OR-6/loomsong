// World positions of Sea's swap spools and the current weft (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const m = g.view.root.matrixWorld;
    const sp = g.controller.swapSpot ? [g.controller.swapSpot] : null;
    const w = (p) => { const v = g.view.root.position.clone().set(p.x, p.y, p.z).applyMatrix4(m); return v.toArray(); };
    return { spots: sp ? sp.map(w) : null, weft: g.model.weft, hint: g.flow.hintStep, level: g.flow.level.id };
  });
}
