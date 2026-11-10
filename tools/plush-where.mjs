// World position of each pokeable shelf plush, plus whether one is singing.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const m = g.view.root.matrixWorld;
    const spots = g.controller.plushSpots.map((s) => (s ? s.clone().applyMatrix4(m).toArray() : null));
    return { spots, singing: g.time < g.singUntil, time: g.time, singUntil: g.singUntil };
  });
}
