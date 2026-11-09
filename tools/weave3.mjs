// Weaves three rows via the controller (lever toggles + auto-throws).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const c = window.__loom.game.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.toggleLever(0);
    for (let i = 0; i < 3; i++) {
      c.throwShuttle();
      await sleep(900);
      if (i === 0) c.toggleLever(1);
    }
    return window.__loom.debug.rows.length;
  });
}
