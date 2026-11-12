// Small delights (E2E helper): DELIGHT_ACTION = wrong (weave a wrong row: no levers) | hello (move the Cup next to the Sprout) | state.
export default async function run({ page, frame }) {
  const action = process.env.DELIGHT_ACTION || 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const L = window.__loom;
    const g = L.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'wrong') {
      for (let k = 0; k < 4; k++) g.controller.applyLatched(k, false);
      await sleep(200);
      g.controller.throwShuttle();
      await sleep(1200);
    }
    if (action === 'hello') {
      const s = g.controller.bankSide;
      let i = -1;
      for (let k = 0; k < 45; k++) if (g.view.plushes.idAt(k) === 'cup') i = k;
      const at = g.progress.placed.sprout;
      g.dropPlush(i, { x: at[0] - s * 0.07, y: 0.01, z: at[1] + 0.02 }); // the other side: a visitor's present may stand on this one
      await sleep(400);
    }
    return { level: g.flow.level.id, phase: g.flow.phase, rows: g.model.rows.length, plaque: L.debug.plaque, reveal: L.debug.nameReveal ?? '', banner: L.debug.banner ?? '', autoUndo: L.debug.autoUndo ?? 0, hello: L.debug.hello ?? 0, lastDrop: L.debug.lastDrop };
  }, action);
}
