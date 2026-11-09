// Seeds a save at level 4 (first generated level) with a1–a3 done.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    localStorage.setItem('loomsong:progress.v1', JSON.stringify({ level: 3, best: { a1: 3, a2: 3, a3: 2 }, tutorialDone: true, theme: 'toy' }));
    localStorage.removeItem('loomsong:settings.v1');
    return 'seeded';
  });
}
