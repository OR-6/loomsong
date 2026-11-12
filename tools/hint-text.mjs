// The table prompt's text (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => window.__loom.game.hint.text);
}
