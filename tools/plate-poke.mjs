// Pokes the loom's name plate through the controller hook (E2E): the same path as a fingertip poke.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    g.controller.hooks.plate?.();
    return { notice: g.debug.notice, phase: g.placement.phase, moved: g.debug.moved ?? 0, spot: !!g.controller.plateSpot };
  });
}
