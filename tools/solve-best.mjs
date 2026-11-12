// Weaves the current level in the fewest lever moves (plans across all rows, as par does), throwing the
// last row and returning at once so a capture can catch the three-star win (capture helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const c = g.controller;
    c.releaseAll();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = g.flow.level;
    while (g.model.rows.some((r, i) => r !== lv.target[i])) g.model.undo(); // a tangled cloth: unpick to the wrong row first
    const n = lv.tieUp.length;
    const S = 1 << n;
    const shed = (s) => { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; return m; };
    const pc = (x) => { let b = 0; while (x) { x &= x - 1; b++; } return b; };
    const rows = lv.target.slice(g.model.rows.length).map((r) => r & 255);
    // dp over rows: cheapest lever states, with back-pointers
    let start = 0;
    for (let k = 0; k < n; k++) if (g.model.latched[k]) start |= 1 << k;
    let cost = new Array(S).fill(Infinity);
    cost[start] = 0;
    const back = [];
    for (const row of rows) {
      const next = new Array(S).fill(Infinity);
      const from = new Array(S).fill(-1);
      for (let s = 0; s < S; s++) {
        if (shed(s) !== row) continue;
        for (let p = 0; p < S; p++) if (cost[p] + pc(p ^ s) < next[s]) { next[s] = cost[p] + pc(p ^ s); from[s] = p; }
      }
      back.push(from);
      cost = next;
    }
    let s = cost.indexOf(Math.min(...cost));
    const plan = [];
    for (let r = rows.length - 1; r >= 0; r--) { plan.unshift(s); s = back[r][s]; }
    for (let r = 0; r < plan.length; r++) {
      for (let k = 0; k < n; k++) if (!!(plan[r] & (1 << k)) !== g.model.latched[k]) c.toggleLever(k);
      g.model.setWeft(lv.target[g.model.rows.length] & 256 ? 1 : 0);
      const before = g.model.rows.length;
      c.throwShuttle();
      if (r === plan.length - 1) return { level: lv.id, lastThrown: true };
      for (let w = 0; w < 40 && g.model.rows.length <= before; w++) await sleep(100);
      await sleep(200);
    }
    return { level: lv.id };
  });
}
