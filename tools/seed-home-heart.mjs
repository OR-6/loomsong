// Review state: Garden done, Home's cup woven, the heart loaded (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    Object.assign(g.progress.best, { sprout: 3, tulip: 3, duck: 2, cup: 3 });
    const i = g.flow ? [...Array(40).keys()].find((k) => { try { return window.__loom.game.flow && k >= 0 && false; } catch { return false; } }) : 0; void i;
    g.pickChapter(1); g.pickChapter(1); // the second poke confirms // jumps to Home's first unfinished picture: the heart
    await new Promise((r) => setTimeout(r, 400));
    return { level: g.flow.level.id };
  });
}
