// The friend picture (Table): FRIEND_ACTION = seed | row (weave the next row with the levers it needs, no friend moves)
// | seat (set the Heart from the shelf on the cushion) | unseat (lift it off) | state (E2E helper).
export default async function run({ page, frame }) {
  const action = process.env.FRIEND_ACTION || 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const L = window.__loom;
    const g = L.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const P = g.view.plushes;
    if (action === 'seed') {
      for (let w = 0; w < 100 && g.flow.phase !== 'play'; w++) await sleep(100);
      g.controller.releaseAll();
      for (const id of ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'star']) g.progress.best[id] = 2;
      g.progress.tutorialDone = true;
      g.flow.start(7);
      await sleep(700);
    }
    if (action === 'row') {
      const lv = g.flow.level;
      const r = g.model.rows.length;
      const f = lv.friend ?? 0;
      let want = lv.target[r] & 255;
      if (f && (want & f) === f && g.model.helper === f) want &= ~f;
      const n = lv.tieUp.length;
      let pick = 0;
      for (let m = 0; m < 1 << n; m++) {
        let sh = 0;
        for (let k = 0; k < n; k++) if ((m >> k) & 1) sh |= lv.tieUp[k];
        if (sh === want) { pick = m; break; }
      }
      for (let k = 0; k < n; k++) g.controller.applyLatched(k, ((pick >> k) & 1) === 1);
      await sleep(300);
      g.controller.throwShuttle();
      await sleep(1700);
    }
    if (action === 'seat') {
      let i = -1;
      for (let k = 0; k < 45; k++) if (P.idAt(k) === 'heart') i = k;
      const c = g.view.cushion.position;
      g.dropPlush(i, { x: c.x, y: 0.03, z: c.z });
      await sleep(600);
    }
    if (action === 'unseat') {
      const i = g.seated;
      g.controller.hooks.carry(i, { x: 0, y: 0.2, z: 0.2 });
      const slot = g.shelf.findIndex((it) => it.id === 'heart');
      const home = P.slotPos(slot, g.tmp2.clone());
      g.dropPlush(i, { x: home.x, y: home.y, z: home.z }); // back onto its shelf
      await sleep(600);
    }
    let heartAt = -1;
    for (let k = 0; k < 45; k++) if (P.idAt(k) === 'heart') heartAt = k;
    return {
      level: g.flow.level.id, phase: g.flow.phase, rows: g.model.rows.length, helper: g.model.helper, shed: g.model.shed,
      friend: L.debug.friend ?? '', hint: L.debug.hint, cushion: g.view.cushion.visible, heartAt, seated: g.seated,
      statuses: g.flow.level.target.map((t, k) => (k < g.model.rows.length ? (g.model.rows[k] === t ? 'ok' : 'x') : '-')).join(''),
    };
  }, action);
}
