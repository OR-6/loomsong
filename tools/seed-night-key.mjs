// Review state: Garden and Home done, Night's key (mystery levers) loaded (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    for (const id of ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'star']) g.progress.best[id] = 3;
    g.syncBasket(g.flow.level);
    g.pickChapter(2);
    await new Promise((r) => setTimeout(r, 400));
    return { level: g.flow.level.id, mystery: g.flow.level.mystery };
  });
}
