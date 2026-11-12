// Reloads the app with the query string in GOTO_SEARCH (e.g. "?visit=1"; empty: none) (E2E helper).
export default async function run({ page, frame }) {
  const search = process.env.GOTO_SEARCH ?? '';
  await (frame ?? page).evaluate((q) => {
    setTimeout(() => (location.search = q), 50);
  }, search);
  return search;
}
