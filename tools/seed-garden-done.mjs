// Marks two Garden pictures woven (unlocks Home) and refreshes the basket (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const locked = (() => { g.pickChapter(1); g.pickChapter(1); return g.flow.level.id; })();
    Object.assign(g.progress.best, { sprout: 3, tulip: 2 });
    g.syncBasket(g.flow.level);
    g.pickChapter(1); g.pickChapter(1); // the second poke confirms
    await new Promise((r) => setTimeout(r, 400));
    return { whileLocked: locked, now: g.flow.level.id, chapter: g.flow.level.chapter };
  });
}
