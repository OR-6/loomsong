// The picture-of-the-day ball (world), its state, and what the game says about today (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const m = g.view.root.matrixWorld;
    const d = g.controller.dailySpot;
    const P = g.view.plushes;
    const ids = [];
    for (let i = 0; i < 45; i++) ids.push(P.idAt(i));
    return {
      ball: d ? d.clone().applyMatrix4(m).toArray() : null,
      visible: g.view.daily.root.visible,
      bow: g.view.daily.bow.visible,
      level: g.flow.level.id,
      daily: g.flow.daily,
      phase: g.flow.phase,
      days: g.progress.days ?? [],
      placed: g.progress.placed ?? {},
      ids,
      notice: g.debug.notice,
      best: g.progress.best,
    };
  });
}
