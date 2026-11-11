// Host side (managed page A): run an action passed via env COOP_ACTION.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  const action = process.env.COOP_ACTION || 'state';
  return await t.evaluate(async (action) => {
    const L = window.__loom;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'host') { await L.coop.host(); for (let i = 0; i < 50 && L.coop.status.message !== 'Waiting for a friend'; i++) await sleep(200); }
    if (action === 'lever0') L.game.controller.toggleLever(0);
    if (action === 'solve') {
      // weave the whole picture from the headset: the right levers for each row, then a throw
      const g = L.game;
      for (let n = 0; n < 40 && g.flow.phase === 'play'; n++) {
        const lv = g.flow.level;
        const want = lv.target[g.model.rows.length] & 255;
        const nl = lv.tieUp.length;
        let pick = 0;
        for (let m = 0; m < 1 << nl; m++) {
          let sh = 0;
          for (let k = 0; k < nl; k++) if ((m >> k) & 1) sh |= lv.tieUp[k];
          if ((sh & 255) === want) { pick = m; break; }
        }
        for (let k = 0; k < nl; k++) g.controller.applyLatched(k, ((pick >> k) & 1) === 1);
        await sleep(250);
        g.controller.throwShuttle();
        await sleep(1600);
      }
      await sleep(1500);
    }
    return { status: L.coop.status, coop: L.debug.coop, level: L.debug.level, latched: L.debug.latched, rows: [...L.debug.rows], notice: L.debug.notice, secret: L.game.view.card.secret, ghostHidden: L.game.view.hideTarget, pinned: L.game.view.pinned, phase: L.game.flow.phase };
  }, action);
}
