// Review state: everything before the Sea Boat finished, the Boat (two-colour weft) loaded (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    // wait out any win or playback first (a chapter pick is ignored mid-celebration)
    for (let w = 0; w < 100 && g.flow.phase !== 'play'; w++) await new Promise((r) => setTimeout(r, 100));
    g.controller.releaseAll();
    for (const id of ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'star', 'moon', 'ghost', 'owl', 'cat', 'fish', 'crab', 'octopus']) g.progress.best[id] = 3;
    g.syncBasket(g.flow.level);
    g.pickChapter(3);
    await new Promise((r) => setTimeout(r, 500));
    return { level: g.flow.level.id, weft: g.flow.level.weft ?? null };
  });
}
