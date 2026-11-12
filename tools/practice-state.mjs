// Practice caller (E2E): ACTION=call pokes the telephone and shortens the wait; ACTION=state reads it.
export default async function run({ page, frame }) {
  const action = process.env.PRACTICE_ACTION ?? 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const g = window.__loom.game;
    if (action === 'call') {
      g.pokePhone();
      g.practiceIn = 0.5; // don't wait the full minute-ish in a test
    }
    if (action === 'hangup') g.pokePhone();
    await new Promise((r) => setTimeout(r, 50));
    const lv = g.flow.level;
    const r = g.model.rows.length;
    return {
      practice: !!g.practice,
      secret: g.view.card.secret,
      pinned: g.view.pinned,
      row: r < lv.target.length ? lv.target[r] & 255 : null,
      rows: r,
      phone: g.view.phone.phoneState,
      phoneShown: g.view.phone.root.visible,
      notices: (g.debug.notices ?? []).slice(-3),
    };
  }, action);
}
