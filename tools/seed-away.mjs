// A returning player: the first picture woven, last here four hours ago (Pip should be asleep) (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    (window.__realSetItem ?? Storage.prototype.setItem).call(localStorage, 'loomsong:progress.v1', JSON.stringify({ level: 1, best: { sprout: 3 }, tutorialDone: true, theme: 'toy', lastSeen: Date.now() - 4 * 3600 * 1000 }));
    return true;
  });
}
