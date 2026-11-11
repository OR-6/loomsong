// The picture card's pokeable rows (world) and the last row played (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const m = g.view.root.matrixWorld;
    const rows = g.controller.cardRows.map((r) => (r ? r.clone().applyMatrix4(m).toArray() : null));
    return { rows, played: g.debug.cardRow ?? null, level: g.flow.level.id };
  });
}
