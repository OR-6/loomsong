// Clears this origin's localStorage (fresh first-run state for E2E).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    try { localStorage.clear(); return 'cleared'; } catch (e) { return String(e); }
  });
}
