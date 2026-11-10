// Tutorial capture helper: weave level 1's three stem rows (lever 0), wait out the goal tag; optional wrong row.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const wrong = !!window.__tutWrong;
    c.releaseAll();
    if (!g.model.latched[0]) c.toggleLever(0);
    for (let r = 0; r < 3; r++) {
      const n = g.model.rows.length;
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100);
      await sleep(300);
    }
    await sleep(7600); // goal tag, then the knots tag
    if (wrong) {
      c.toggleLever(1); // both up: the leaves row needs lever 0 down
      const n = g.model.rows.length;
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100);
      await sleep(400);
    }
    return { hint: g.flow.hintStep, lever: g.hintLever, rows: g.model.rows.length };
  });
}
