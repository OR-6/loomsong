// Review state: Garden done and two Garden plushes and the cup living on the desk; Home's heart loaded (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    const s = g.controller.bankSide;
    Object.assign(g.progress.best, { sprout: 3, tulip: 2, duck: 3, cup: 3 });
    g.progress.placed = { sprout: [s * 0.2, 0.19], duck: [s * 0.29, 0.18], cup: [-s * 0.42, 0.12] }; // the spots the game itself picks first
    g.flow.start(4);
    await new Promise((r) => setTimeout(r, 500));
    return { level: g.flow.level.id, ids: Array.from({ length: 21 }, (_, i) => g.view.plushes.idAt(i)) };
  });
}
