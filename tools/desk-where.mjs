// Plush spots (world), desk targets (world) and what the last drop did (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const root = g.view.root;
    const m = root.matrixWorld;
    const spots = g.controller.plushSpots.map((s) => (s ? s.clone().applyMatrix4(m).toArray() : null));
    const side = g.controller.bankSide;
    const at = (x, y, z) => root.localToWorld(root.position.clone().set(x, y, z)).toArray();
    const P = window.__loom.game.view.plushes;
    const ids = [];
    for (let i = 0; i < 21; i++) ids.push(P.idAt(i));
    return {
      spots,
      ids,
      desk: at(side * 0.3, 0.012, 0.19),
      inLoom: at(0, 0.03, 0.02),
      shelf: [0, 1, 2, 3, 4].map((k) => { const v = P.slotPos(k, root.position.clone()); v.y += 0.02; return root.localToWorld(v).toArray(); }),
      placed: g.progress.placed ?? {},
      saved: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('progress')) ?? 'x') ?? 'null')?.placed ?? null,
      lastDrop: g.debug.lastDrop ?? '',
      carried: P.carried,
      notice: g.debug.notice,
      singUntil: g.singUntil,
      time: g.time,
    };
  });
}
