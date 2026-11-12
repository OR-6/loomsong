// Draws a three-panel gallery strip from three stills served from public/_strip during capture.
// Env: STRIP_FILES (3, comma-separated), STRIP_LABELS (3, '|'), STRIP_CAPTION, STRIP_CROPS (3 left edges), STRIP_SRC_W/H.
export default async function run({ page, frame }) {
  const cfg = {
    files: (process.env.STRIP_FILES ?? '07-levers.jpg,04-a-hand-shows-how.jpg,01-picture-comes-alive.jpg').split(','),
    labels: (process.env.STRIP_LABELS ?? 'Push levers|Slide Pip|It comes alive').split('|'),
    caption: process.env.STRIP_CAPTION ?? 'Every row plays a tune. Every picture becomes a plush.',
    crops: (process.env.STRIP_CROPS ?? '520,370,370').split(',').map(Number),
    sw: Number(process.env.STRIP_SRC_W ?? 760),
    sh: Number(process.env.STRIP_SRC_H ?? 1000),
  };
  return await (frame ?? page).evaluate(async (cfg) => {
    await document.fonts.load('64px "Lilita One"');
    await document.fonts.load('40px "Fraunces"');
    const base = location.pathname.replace(/[^/]*$/, '');
    const get = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `${base}_strip/${n}`; });
    const imgs = [await get(cfg.files[0]), await get(cfg.files[1]), await get(cfg.files[2])];
    const crops = cfg.crops; // left edge of a sw-wide slice of each still
    const W = 1500, H = 1000;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#efd9b8'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 46) { g.fillStyle = y % 92 ? 'rgba(160,110,60,0.05)' : 'rgba(160,110,60,0.08)'; g.fillRect(0, y, W, 22); }
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const labels = cfg.labels;
    const pw = 440, ph = 580, gap = (W - 3 * pw) / 4;
    for (let k = 0; k < 3; k++) {
      const x = gap + k * (pw + gap), y = 210;
      g.save(); g.shadowColor = 'rgba(90,60,30,0.3)'; g.shadowBlur = 20; g.shadowOffsetY = 8; g.fillStyle = '#fbf3e4'; rr(x - 10, y - 10, pw + 20, ph + 20, 18); g.fill(); g.restore();
      g.save(); rr(x, y, pw, ph, 12); g.clip(); g.drawImage(imgs[k], crops[k], 0, cfg.sw, cfg.sh, x, y, pw, ph); g.restore();
      // number badge + label
      g.fillStyle = '#e2563b'; g.beginPath(); g.arc(x + 34, 140, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '40px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), x + 34, 142);
      g.fillStyle = '#4a3527'; g.font = '50px "Lilita One"'; g.textAlign = 'left'; g.fillText(labels[k], x + 78, 142);
      if (k < 2) { g.fillStyle = '#c98a4b'; g.font = '60px "Lilita One"'; g.textAlign = 'center'; g.fillText('›', x + pw + gap / 2, y + ph / 2); }
    }
    g.fillStyle = '#7a6250'; g.font = '38px "Fraunces"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(cfg.caption, W / 2, 900);
    return cv.toDataURL('image/jpeg', 0.92);
  }, cfg);
}
