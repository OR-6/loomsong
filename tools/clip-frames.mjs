// Records a short gameplay clip: grabs frames of the managed page for SECS seconds (env OUT dir, FPS).
export default async function run({ page }) {
  const out = process.env.OUT;
  const secs = +(process.env.SECS || 10);
  const fps = +(process.env.FPS || 12);
  const n = Math.round(secs * fps);
  const t0 = Date.now();
  let i = 0;
  while (i < n) {
    const due = t0 + (i * 1000) / fps;
    const wait = due - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 85 });
    i++;
  }
  return { frames: n, ms: Date.now() - t0 };
}
