// Navigates the app to a #w= share link (same origin) and reloads.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  const code = await t.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('loomsong:progress.v1')).lastCloth;
    const bytes = [1, c.tieUp.length, ...c.tieUp, c.rows.length, ...c.rows, c.rootMidi];
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  });
  await t.evaluate((code) => { location.hash = 'w=' + code; location.reload(); }, code);
  await new Promise((r) => setTimeout(r, 3000));
  return await (frame ?? page).evaluate(() => ({
    hash: location.hash,
    tagline: document.querySelector('#tagline')?.textContent,
    challenge: window.__loom?.debug?.challenge,
    level: window.__loom?.game?.flow?.level?.id,
  }));
}
