// Garden woven and Home's first two pictures too; the Star loaded: the toy telephone is out by now (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    Object.assign(g.progress.best, { sprout: 3, tulip: 2, duck: 2, table: 2, heart: 2, house: 2 });
    g.progress.tutorialDone = true;
    g.flow.start(6);
    await new Promise((r) => setTimeout(r, 500));
    return { level: g.flow.level.id };
  });
}
