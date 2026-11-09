// Host side (managed page A): run an action passed via env COOP_ACTION.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  const action = process.env.COOP_ACTION || 'state';
  return await t.evaluate(async (action) => {
    const L = window.__loom;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'host') { await L.coop.host(); for (let i = 0; i < 50 && L.coop.status.message !== 'Waiting for a friend'; i++) await sleep(200); }
    if (action === 'lever0') L.game.controller.toggleLever(0);
    return { status: L.coop.status, coop: L.debug.coop, level: L.debug.level, latched: L.debug.latched, rows: [...L.debug.rows], notice: L.debug.notice };
  }, action);
}
