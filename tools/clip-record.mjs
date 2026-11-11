// Records a gameplay clip: starts weaving the rest of the level in the page, and grabs frames meanwhile (env OUT, SECS, FPS).
export default async function run({ page }) {
  const out = process.env.OUT;
  const secs = +(process.env.SECS || 12);
  const fps = +(process.env.FPS || 12);
  const play = page.evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = g.flow.level;
    const n = lv.tieUp.length;
    await sleep(500);
    for (let r = g.model.rows.length; r < lv.target.length; r++) {
      let best = -1, bf = 99;
      for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m !== (lv.target[r] & 255)) continue; let f = 0; for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) f++; if (f < bf) { bf = f; best = s; } }
      for (let k = 0; k < n; k++) if (!!(best & (1 << k)) !== g.model.latched[k]) { c.toggleLever(k); await sleep(420); }
      await sleep(350);
      c.throwShuttle();
      for (let w = 0; w < 50 && g.model.rows.length <= r; w++) await sleep(50);
      await sleep(650);
    }
    return g.model.rows.length;
  });
  const n = Math.round(secs * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const wait = t0 + (i * 1000) / fps - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
  }
  return { rows: await play, frames: n, ms: Date.now() - t0 };
}
