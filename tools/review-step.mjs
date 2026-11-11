// Capture helper: 'lever0' lifts lever 0; otherwise weaves two stem rows and lifts lever 1 beside it (the aha).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (!g.model.latched[0]) c.toggleLever(0);
    if (g.model.rows.length === 0 && window.__reviewLever0Done) {
      for (let r = 0; r < 2; r++) {
        const n = g.model.rows.length;
        c.throwShuttle();
        for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100);
        await sleep(400);
      }
      await sleep(7000); // the goal tag, then the knots tag
      if (!g.model.latched[1]) c.toggleLever(1);
      await sleep(300);
    }
    window.__reviewLever0Done = true;
    return { rows: g.model.rows.length, hint: g.debug.hint };
  });
}
