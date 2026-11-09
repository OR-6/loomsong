// Completes Level 1 from "row 1 woven, lever 0 latched" via the controller.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const c = window.__loom.game.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    c.throwShuttle(); await sleep(1100);           // row 2: L0
    c.toggleLever(1); c.throwShuttle(); await sleep(1100); // row 3: L0+L1
    c.toggleLever(0); c.throwShuttle(); await sleep(1100); // row 4: L1
    return window.__loom.debug.rows;
  });
}
