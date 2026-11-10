// Tutorial capture helper: from the "put lever 0 back" step, weave a wrong row instead.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.releaseAll();
    c.toggleLever(1);
    const n = g.model.rows.length;
    c.throwShuttle();
    for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100);
    await sleep(600);
    return { hint: g.flow.hintStep, rows: g.model.rows.length };
  });
}
