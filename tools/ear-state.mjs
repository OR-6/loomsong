// Weave-by-ear probe (E2E): the chosen row, the card's patch, the hint, hums and result.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    return {
      level: g.flow.level.id,
      earRow: g.earRow,
      patch: g.view.card.earRow,
      rows: g.model.rows.length,
      tag: g.tutor.text,
      hums: g.debug.earHums ?? 0,
      result: g.debug.earResult ?? '',
      banner: g.debug.banner ?? '',
    };
  });
}
