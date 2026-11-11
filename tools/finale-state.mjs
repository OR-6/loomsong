// Chapter-finale state (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    return { notice: g.debug.banner || g.notice, level: g.flow.level.id, phase: g.flow.phase, singing: g.time < g.singUntil, finalePending: !!g.finale, time: +g.time.toFixed(2) };
  });
}
