// Night's Owl, which arrives tangled, with Garden, Home and Night's first two woven; reports its rows (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    for (const k of Object.keys(g.progress.best)) delete g.progress.best[k];
    for (const id of ['sprout', 'tulip', 'duck', 'table', 'heart', 'house', 'star', 'cup', 'moon', 'ghost']) g.progress.best[id] = 2;
    g.progress.tutorialDone = true;
    g.flow.start(10);
    await new Promise((r) => setTimeout(r, 700));
    const lv = g.flow.level;
    return { id: lv.id, rows: [...g.model.rows], target: lv.target, mend: lv.mend, par: lv.par, step: g.flow.hintStep };
  });
}
