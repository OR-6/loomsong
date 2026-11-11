// Phone-caller side: a second tab joins the host's code as the caller (2D card + lever buttons).
export default async function run({ context }) {
  const action = process.env.COOP_ACTION || 'state';
  const code = process.env.COOP_CODE || '';
  const shotPath = process.env.SHOT || '';
  let b = context.pages().find((p) => p.url().includes('caller=1'));
  if (!b) {
    b = await context.newPage();
    await b.setViewportSize({ width: 390, height: 844 }); // a phone
    await b.goto('https://localhost:8081/?caller=1', { waitUntil: 'load' });
    await b.waitForFunction(() => !!window.__loom, null, { timeout: 30000 });
  }
  if (action === 'shot' && shotPath) {
    await b.setViewportSize({ width: 390, height: 844 });
    // hide the desktop emulator's own overlay (not part of the page)
    await b.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (e.id !== 'enter-xr' && !e.closest('#caller') && !e.closest('#landing') && /Enter XR/.test(e.textContent || '') && e.children.length < 6) e.style.display = 'none'; } });
    await b.addStyleTag({ content: '#caller{padding-top:66px !important}' });
    await b.waitForTimeout(250);
    await b.screenshot({ path: shotPath, clip: { x: 0, y: 52, width: 390, height: 590 } });
    return { shot: shotPath };
  }
  return await b.evaluate(async ({ action, code }) => {
    const L = window.__loom;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'call') { await L.coop.join(code, 'caller'); for (let i = 0; i < 60 && L.coop.status.state !== 'connected'; i++) await sleep(200); await sleep(1200); }
    if (action === 'press0') { document.querySelector('#caller .lever')?.click(); await sleep(900); }
    if (action === 'leave') { L.coop.leave(); await sleep(800); }
    const view = document.querySelector('#caller');
    return {
      status: L.coop.status,
      view: !!view,
      text: view?.querySelector('.status')?.textContent ?? null,
      levers: [...(view?.querySelectorAll('.lever') ?? [])].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`),
    };
  }, { action, code });
}
