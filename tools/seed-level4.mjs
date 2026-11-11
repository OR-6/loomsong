// Seeds a save at level 3 (the Duck) with the first two Garden pictures done.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    localStorage.setItem('loomsong:progress.v1', JSON.stringify({ level: 2, best: { sprout: 3, tulip: 3 }, tutorialDone: true, theme: 'toy' }));
    localStorage.removeItem('loomsong:settings.v1');
    return 'seeded';
  });
}
