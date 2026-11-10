// Jumps back to the Garden chapter via the basket hook (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.pickChapter(0);
    await new Promise((r) => setTimeout(r, 400));
    return { level: g.flow.level.id };
  });
}
