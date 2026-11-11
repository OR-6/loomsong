// Grand finale diagnostics; GRAND_ACTION=solve weaves the current picture from the headset (right levers, then a throw).
export default async function run({ page, frame }) {
  const action = process.env.GRAND_ACTION || 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const L = window.__loom;
    const g = L.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'solve') {
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
        // Sea water rows: swap the yarn first
        g.controller.hooks.swap && ((lv.target[g.model.rows.length] & 256) ? 1 : 0) !== g.model.weft && g.controller.hooks.swap();
        for (let k = 0; k < nl; k++) g.controller.applyLatched(k, ((pick >> k) & 1) === 1);
        await sleep(250);
        g.controller.throwShuttle();
        await sleep(1600);
      }
    }
    return { level: g.flow.level.id, phase: g.flow.phase, challenge: g.flow.challenge, grand: L.debug.grand ?? '', grandIn: g.grandIn, banner: L.debug.banner ?? '', plaque: L.debug.plaque, rows: g.model.rows.length, allow: g.controller.allow, shelf: g.view.plushes.tag?.text ?? '' };
  }, action);
}
