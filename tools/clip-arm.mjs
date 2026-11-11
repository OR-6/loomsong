// Arms the clip's play inside the page: after DELAY ms it weaves the rest of the level (returns at once).
export default async function run({ page, frame }) {
  const delay = +(process.env.DELAY || 2500);
  return await (frame ?? page).evaluate((delay) => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const play = async () => {
      const lv = g.flow.level;
      const n = lv.tieUp.length;
      for (let r = g.model.rows.length; r < lv.target.length; r++) {
        let best = -1, bf = 99;
        for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m !== (lv.target[r] & 255)) continue; let f = 0; for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) f++; if (f < bf) { bf = f; best = s; } }
        for (let k = 0; k < n; k++) if (!!(best & (1 << k)) !== g.model.latched[k]) { c.toggleLever(k); await sleep(420); }
        await sleep(350);
        c.throwShuttle();
        for (let w = 0; w < 50 && g.model.rows.length <= r; w++) await sleep(50);
        await sleep(650);
      }
    };
    setTimeout(() => void play(), delay);
    return 'armed';
  }, delay);
}
