// Pokes shelf plush `i` through the controller hook (capture/E2E helper) and reports its song length.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const spots = c.plushSpots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (!spots.length) return { spots };
    const i = spots[0];
    const near = c.nearest(c.plushSpots[i], 0.03);
    c.hooks.plush?.(i);
    return { spots, near, singUntil: g.singUntil, time: g.time };
  });
}
