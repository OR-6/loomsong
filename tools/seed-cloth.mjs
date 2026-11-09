// Seeds a finished cloth and fires the update event (share-card check).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const p = JSON.parse(localStorage.getItem('loomsong:progress.v1') || '{}');
    p.lastCloth = { tieUp: [0x33, 0x66, 0xcc, 0x99], rows: [0x33, 0x66, 0xcc, 0x99, 0x33, 0x66], rootMidi: 65 };
    localStorage.setItem('loomsong:progress.v1', JSON.stringify(p));
    window.dispatchEvent(new CustomEvent('loomsong:cloth'));
    return 'ok';
  });
}
