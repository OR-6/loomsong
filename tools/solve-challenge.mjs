// Weaves the current (2-lever) shared cloth [L0],[L0+L1] through the controller.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const c = window.__loom.game.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.toggleLever(0); c.throwShuttle(); await sleep(1000);
    c.toggleLever(1); c.throwShuttle(); await sleep(1000);
    return window.__loom.debug.rows;
  });
}
