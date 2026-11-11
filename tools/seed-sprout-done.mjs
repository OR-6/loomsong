// The first picture woven (tutorial done); the Tulip loaded (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    Object.assign(g.progress.best, { sprout: 3 });
    g.progress.tutorialDone = true;
    g.flow.start(1);
    await new Promise((r) => setTimeout(r, 400));
    return { level: g.flow.level.id };
  });
}
