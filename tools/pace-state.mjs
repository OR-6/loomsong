// Pace, toolkit and tide checks (E2E helper). PACE_ACTION: state | again (poke shelf plush 0 three times, as
// a player poking it again while it sings) | seat (seat the first shelf plush on the cushion).
export default async function run({ page, frame }) {
  const action = process.env.PACE_ACTION ?? 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const g = window.__loom.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (action === 'again') {
      for (let k = 0; k < 3; k++) {
        g.controller.hooks.plush(0);
        await sleep(400);
      }
      await sleep(600);
    }
    if (action === 'seat') {
      const id = g.view.plushes.idAt(0);
      g.seatFriend(0, id);
      await sleep(300);
    }
    return {
      level: g.flow.level.id,
      phase: g.flow.phase,
      rows: g.model.rows.length,
      winSkips: g.debug.winSkips ?? 0,
      again: g.debug.weaveAgain ?? '',
      cushion: g.view.cushion.visible,
      cushionOut: g.cushionOut(g.flow.level),
      helper: g.model.helper,
      tideFrom: g.view.card.tideFrom,
      settings: g.setLabels.map((l) => l.text),
      notices: (g.debug.notices ?? []).slice(-3),
    };
  }, action);
}
