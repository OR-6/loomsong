// Review state: everything before the Sea Boat finished, the Boat (two-colour weft) loaded (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    for (const id of ['sprout', 'tulip', 'tree', 'duck', 'cup', 'heart', 'house', 'mushroom', 'star', 'moon', 'ghost', 'owl', 'cat', 'fish', 'crab', 'octopus', 'jelly']) g.progress.best[id] = 3;
    g.syncBasket(g.flow.level);
    g.pickChapter(3);
    await new Promise((r) => setTimeout(r, 500));
    return { level: g.flow.level.id, weft: g.flow.level.weft ?? null };
  });
}
