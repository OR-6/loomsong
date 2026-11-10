// Mid-game review state: Garden's sprout, tulip and tree woven (plushes on the
// shelf), the duck loaded (E2E/capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    Object.assign(g.progress.best, { sprout: 3, tulip: 3, tree: 2 });
    const idx = window.__loom.game.flow.index; void idx;
    g.flow.start(3);
    await new Promise((r) => setTimeout(r, 400));
    return { level: g.flow.level.id };
  });
}
