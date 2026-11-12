// Every picture woven except the Boat, which is loaded: weave it to finish the game (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    g.controller.releaseAll();
    const ids = ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'star', 'table', 'moon', 'ghost', 'owl', 'cat', 'lantern', 'fish', 'crab', 'octopus', 'jellyfish'];
    for (const [i, id] of ids.entries()) g.progress.best[id] = i % 3 === 0 ? 3 : 2;
    g.progress.tutorialDone = true;
    g.flow.start(16); // the Boat: the last picture left (the Jellyfish is done)
    await new Promise((r) => setTimeout(r, 600));
    return { level: g.flow.level.id };
  });
}
