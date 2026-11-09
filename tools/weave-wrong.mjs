// On Level 2: weave a correct first row, then a wrong second row.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const c = window.__loom.game.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.toggleLever(0); c.throwShuttle(); await sleep(1100);
    c.toggleLever(1); c.throwShuttle(); await sleep(1100);
    return window.__loom.debug.rows;
  });
}
