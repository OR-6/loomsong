// Turns Look to play on through the same path as the 2D page toggle.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const s = JSON.parse(localStorage.getItem('loomsong:settings.v1') || '{}');
    localStorage.setItem('loomsong:settings.v1', JSON.stringify({ ...s, lookToPlay: true }));
    window.dispatchEvent(new CustomEvent('loomsong:settings'));
    return 'look on';
  });
}
