// Pip's nap (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => ({ asleep: window.__loom.game.view.pipAsleep, lastSeen: window.__loom.game.progress.lastSeen ?? null }));
}
