// Weaves one wrong row then undoes and weaves the right one, reporting Pip's mood after each (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitRows = async (n) => { for (let i = 0; i < 40 && g.model.rows.length !== n; i++) await sleep(100); };
    c.releaseAll();
    await sleep(200);
    const lv = g.flow.level;
    const r = g.model.rows.length;
    // wrong: latch every lever
    for (let k = 0; k < lv.tieUp.length; k++) if (!g.model.latched[k]) c.toggleLever(k);
    c.throwShuttle();
    await waitRows(r + 1);
    await sleep(250);
    const sad = g.view.mood;
    await sleep(1600);
    return { level: lv.id, sad, wrongRow: g.model.rows[r], target: lv.target[r] };
  });
}
