// Guest side: a second tab in the same browser context (?desk auto-places).
export default async function run({ context }) {
  const action = process.env.COOP_ACTION || 'state';
  const code = process.env.COOP_CODE || '';
  let b = context.pages().find((p) => p.url().includes('desk=0.75'));
  if (!b) {
    b = await context.newPage();
    await b.goto('https://localhost:8081/?desk=0.75', { waitUntil: 'load' });
    await b.waitForFunction(() => !!window.__loom, null, { timeout: 30000 });
  }
  return await b.evaluate(async ({ action, code }) => {
    const L = window.__loom;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'clear') { try { localStorage.clear(); } catch {} location.reload(); return 'reloaded'; }
    if (action === 'join') { await L.coop.join(code); for (let i = 0; i < 60 && L.coop.status.state !== 'connected'; i++) await sleep(200); }
    if (action === 'enter') { L.game.world.launchXR(); await sleep(2500); }
    if (action === 'drag') {
      const s = L.game.controller.shuttle; const from = s.t, to = from < 0.5 ? 1 : 0;
      s.held = true;
      for (let i = 0; i <= 40; i++) { s.t = from + (to - from) * (i / 40); await sleep(25); }
      await sleep(150); s.held = false; await sleep(700);
    }
    if (action === 'throw') { L.game.controller.throwShuttle(); await sleep(1300); }
    if (action === 'undo') { L.game.controller.doUndo(); await sleep(600); }
    if (action === 'leave') { L.coop.leave(); await sleep(800); }
    return { status: L.coop.status, coop: L.debug.coop, phase: L.debug.phase, level: L.debug.level, latched: L.debug.latched, rows: [...L.debug.rows], notice: L.debug.notice, applied: L.game.coopLink?.applied ?? null };
  }, { action, code });
}
