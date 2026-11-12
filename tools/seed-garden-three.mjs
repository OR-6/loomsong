// Three Garden pictures woven (the basket and the present are out by now); the Table loaded (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    Object.assign(g.progress.best, { sprout: 3, tulip: 2, duck: 2 });
    g.progress.tutorialDone = true;
    g.flow.start(3);
    await new Promise((r) => setTimeout(r, 500));
    return { level: g.flow.level.id };
  });
}
