// Returns the current level's tie-up and target (for solving in E2E).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const f = window.__loom.game.flow;
    return { id: f.level.id, tieUp: [...f.level.tieUp], target: [...f.level.target], par: f.level.par, index: f.index };
  });
}
