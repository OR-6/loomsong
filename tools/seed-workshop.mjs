// Seeds a save with Workshop unlocked and selected.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    localStorage.setItem('loomsong:progress.v1', JSON.stringify({ level: 0, best: { a1: 3, a2: 2, a3: 3 }, tutorialDone: true, theme: 'workshop' }));
    return 'seeded';
  });
}
