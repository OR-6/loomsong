// Unlocks Night (Garden + Home woven), jumps there, and reports lever dye before/after trying lever 0 (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'mushroom']) g.progress.best[id] = 3;
    g.syncBasket(g.flow.level);
    g.pickChapter(2); g.pickChapter(2); // the second poke confirms
    await sleep(300);
    const hex = () => g.view.leverMats.map((m) => m.color.getHexString());
    const before = hex();
    g.controller.toggleLever(0);
    await sleep(500);
    return { level: g.flow.level.id, mystery: g.flow.level.mystery, before, after: hex() };
  });
}
