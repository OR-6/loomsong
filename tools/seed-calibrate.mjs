// Fresh save + "Fit to my hands" queued for the next entry.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname + location.search);
    localStorage.setItem('loomsong:progress.v1', JSON.stringify({ level: 1, best: { a1: 3 }, tutorialDone: true, theme: 'toy' }));
    localStorage.setItem('loomsong:settings.v1', JSON.stringify({ highContrast: false, hand: 'auto', calibrateNext: true }));
    return 'ok';
  });
}
