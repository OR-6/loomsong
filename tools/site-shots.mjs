// Landing review captures: sizes, scroll, co-op open, keyboard focus, no-XR state, a last cloth to share (env OUT dir).
export default async function run({ context }) {
  const out = process.env.OUT;
  const shots = [];
  const open = async (w, h, setup) => {
    const p = await context.newPage();
    await p.setViewportSize({ width: w, height: h });
    await p.goto('https://localhost:8081/?review=1', { waitUntil: 'load' });
    if (setup) await p.evaluate(setup);
    if (setup) { await p.reload({ waitUntil: 'load' }); }
    await p.waitForTimeout(5200);
    return p;
  };
  const shot = async (p, name, full = false) => { const f = `${out}/${name}.png`; await p.screenshot({ path: f, fullPage: false }); shots.push(f); };
  const scroll = (p, y) => p.evaluate((y) => document.getElementById('landing').scrollTo(0, y), y);
  const seedCloth = () => {
    const raw = localStorage.getItem('loomsong:progress.v1');
    const pr = raw ? JSON.parse(raw) : { level: 4, best: {}, tutorialDone: true, theme: 'toy' };
    pr.lastCloth = { tieUp: [24, 36], rows: [24, 24, 24, 36], rootMidi: 62 };
    pr.best = { sprout: 3, tulip: 3, tree: 2, duck: 3 };
    localStorage.setItem('loomsong:progress.v1', JSON.stringify(pr));
  };
  // desktop
  let p = await open(1440, 900);
  await shot(p, 'd1-desktop-top');
  await scroll(p, 700); await p.waitForTimeout(200); await shot(p, 'd2-desktop-scrolled');
  await p.click('#coop summary'); await p.waitForTimeout(200); await scroll(p, 2000); await p.waitForTimeout(200); await shot(p, 'd3-desktop-coop-open');
  await scroll(p, 0); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(150); await shot(p, 'd4-desktop-focus');
  const meta = await p.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name=description]')?.content ?? null,
    og: document.querySelector('meta[property="og:image"]')?.content ?? null,
    favicon: document.querySelector('link[rel=icon]')?.href ?? null,
    h1: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 30)),
    imgsNoAlt: [...document.querySelectorAll('#landing img')].filter((i) => !i.alt).length,
    hScroll: document.getElementById('landing').scrollWidth > document.getElementById('landing').clientWidth,
  }));
  await p.close();
  // no-XR visitor (as on a laptop without a headset)
  p = await open(1440, 900);
  await p.evaluate(() => { document.querySelector('.go').hidden = true; document.getElementById('xr-unsupported').hidden = false; });
  await shot(p, 'd5-desktop-no-xr');
  await p.close();
  // returning player with a cloth to share and the style unlocked
  p = await open(1440, 900, seedCloth);
  await scroll(p, 600); await p.waitForTimeout(200); await shot(p, 'd6-desktop-returning');
  await p.close();
  // tablet
  p = await open(768, 1024); await shot(p, 't1-tablet'); await p.close();
  // phone
  p = await open(375, 812); await shot(p, 'p1-phone-top');
  const phoneScroll = await p.evaluate(() => ({ h: document.getElementById('landing').scrollHeight, cta: document.getElementById('enter-xr').getBoundingClientRect().bottom }));
  await scroll(p, 760); await p.waitForTimeout(200); await shot(p, 'p2-phone-mid');
  await scroll(p, 99999); await p.waitForTimeout(200); await shot(p, 'p3-phone-bottom');
  await p.close();
  return { shots, meta, phoneScroll };
}
