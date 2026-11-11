// Diagnostics: as with a phone caller, hide the picture and pin the next row's threads; Pip waves.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  return await t.evaluate(async () => {
    const g = window.__loom.game;
    const v = g.view;
    g.setCallerGap(true);
    const row = g.flow.level.target[g.model.rows.length] ?? 0;
    v.clearPins();
    for (let i = 0; i < 8; i++) if ((row >> i) & 1) v.pinThread(i, true);
    v.setPipMood('wave');
    await new Promise((r) => setTimeout(r, 600));
    return v.pinned;
  });
}
