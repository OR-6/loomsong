// Draws the "push, slide, it comes alive" gallery strip from three stills (served from public/_strip during capture).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    await document.fonts.load('64px "Lilita One"');
    await document.fonts.load('40px "Fraunces"');
    const base = location.pathname.replace(/[^/]*$/, '');
    const get = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `${base}_strip/${n}`; });
    const imgs = [await get('07-levers.jpg'), await get('04-a-hand-shows-how.jpg'), await get('01-picture-comes-alive.jpg')];
    const crops = [520, 370, 370]; // left edge of a 760-wide slice of each 1500x1000 still
    const W = 1500, H = 1000;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#efd9b8'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 46) { g.fillStyle = y % 92 ? 'rgba(160,110,60,0.05)' : 'rgba(160,110,60,0.08)'; g.fillRect(0, y, W, 22); }
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const labels = ['Push levers', 'Slide Pip', 'It comes alive'];
    const pw = 440, ph = 580, gap = (W - 3 * pw) / 4;
    for (let k = 0; k < 3; k++) {
      const x = gap + k * (pw + gap), y = 210;
      g.save(); g.shadowColor = 'rgba(90,60,30,0.3)'; g.shadowBlur = 20; g.shadowOffsetY = 8; g.fillStyle = '#fbf3e4'; rr(x - 10, y - 10, pw + 20, ph + 20, 18); g.fill(); g.restore();
      g.save(); rr(x, y, pw, ph, 12); g.clip(); g.drawImage(imgs[k], crops[k], 0, 760, 1000, x, y, pw, ph); g.restore();
      // number badge + label
      g.fillStyle = '#e2563b'; g.beginPath(); g.arc(x + 34, 140, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '40px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), x + 34, 142);
      g.fillStyle = '#4a3527'; g.font = '50px "Lilita One"'; g.textAlign = 'left'; g.fillText(labels[k], x + 78, 142);
      if (k < 2) { g.fillStyle = '#c98a4b'; g.font = '60px "Lilita One"'; g.textAlign = 'center'; g.fillText('›', x + pw + gap / 2, y + ph / 2); }
    }
    g.fillStyle = '#7a6250'; g.font = '38px "Fraunces"'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('Every row plays a tune. Every picture becomes a plush.', W / 2, 900);
    return cv.toDataURL('image/jpeg', 0.92);
  });
}
