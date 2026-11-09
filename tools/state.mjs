// Returns live game state from the running app (browser run helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const L = window.__loom;
    if (!L) return null;
    const h = (s) => ({
      tracked: L.hands[s].tracked,
      pinching: L.hands[s].pinch.pinching,
      pinchMm: L.hands[s].pinchDist === null ? null : Math.round(L.hands[s].pinchDist * 1000),
      pinchPoint: L.hands[s].pinchPoint.toArray(),
      upDot: L.hands[s].upDot,
    });
    return JSON.parse(JSON.stringify({ debug: L.debug, right: h('right'), left: h('left'), targets: L.targets() }));
  });
}
