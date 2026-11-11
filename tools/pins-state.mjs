// Diagnostics: pin threads 2, 5 and 6 as a phone caller would, and make Pip wave.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  return await t.evaluate(async () => {
    const v = window.__loom.game.view;
    v.clearPins(); v.pinThread(2, true); v.pinThread(5, true); v.pinThread(6, true); v.setPipMood('wave');
    await new Promise((r) => setTimeout(r, 600));
    return v.pinned;
  });
}
