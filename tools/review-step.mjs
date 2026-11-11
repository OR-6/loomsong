// Capture helper, called three times: 1) lifts lever 0; 2) weaves two stem rows and waits
// for the "more threads" hint; 3) lifts lever 1 beside lever 0 (the aha).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const n = (window.__reviewStep = (window.__reviewStep ?? 0) + 1);
    if (n === 1) {
      if (!g.model.latched[0]) c.toggleLever(0);
    } else if (n === 2) {
      for (let r = 0; r < 2; r++) {
        const k = g.model.rows.length;
        c.throwShuttle();
        for (let w = 0; w < 40 && g.model.rows.length <= k; w++) await sleep(100);
        await sleep(400);
      }
      await sleep(7600); // the goal tag, then the knots tag, then "more threads"
    } else if (!g.model.latched[1]) {
      c.toggleLever(1);
      await sleep(500);
    }
    return { rows: g.model.rows.length, hint: g.debug.hint };
  });
}
