// World position of the shelf's wind-up key, and the medley state (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const k = g.controller.keySpot;
    const p = k ? k.clone().applyMatrix4(g.view.root.matrixWorld).toArray() : null;
    const pl = g.view.plushes;
    return { key: p, time: g.time, singUntil: g.singUntil, waits: [...pl.singWait].map((x) => +x.toFixed(2)), left: [...pl.singLeft].map((x) => +x.toFixed(2)) };
  });
}
