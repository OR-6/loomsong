export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.progress.best.boat = 3;
    g.progress.grandSeen = false;
    const s = g.controller.bankSide;
    const spots = [[0.2, 0.19], [0.29, 0.18], [-0.42, 0.12], [0.44, 0.09], [-0.46, 0.05]];
    const ids = ['sprout', 'duck', 'cup', 'moon', 'fish'];
    g.progress.placed = Object.fromEntries(ids.map((id, i) => [id, [s * spots[i][0], spots[i][1]]]));
    g.flow.start(17); // the last picture: the Sea's shelf (the ending is after the last chapter)
    await new Promise((r) => setTimeout(r, 1200));
    g.startGrand();
    return 'go';
  });
}
