// Visitors probe (E2E): today's pick, what it likes, where the present stands and where that plush is.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const pick = g.progress.dailyPick;
    return { pick, placed: g.progress.placed ?? {}, gift: [...g.giftAt], giftShown: g.view.daily.root.visible, visitor: g.debug.visitor ?? '', notices: (g.debug.notices ?? []).slice(-3), level: g.flow.level.id };
  });
}
