// Weaves three rows via the controller (lever toggles + auto-throws).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.toggleLever(0);
    for (let i = 0; i < 3; i++) {
      const n = g.model.rows.length;
      c.throwShuttle();
      for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100); // wait for the pass to land
      await sleep(300);
      if (i === 1) c.toggleLever(1); // the Sprout: stem, stem, then stem and leaves (all right rows)
    }
    return window.__loom.debug.rows.length;
  });
}
