// The recorded soundtrack: which track plays, its load state, the game's key, and the bus (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const a = window.__loom.audio;
    const g = window.__loom.game;
    a.resume();
    await new Promise((r) => setTimeout(r, 4000));
    const t = a.track;
    return { ctx: a.ctx?.state ?? null, chapter: a.chapter, track: t?.name ?? null, playing: t?.playing ?? false, at: t ? +t.el.currentTime.toFixed(1) : null, trackGain: t ? +t.gain.gain.value.toFixed(3) : null, failed: [...a.trackFailed], root: a.rootMidi, level: g.flow.level.id, pad: !!a.pad };
  });
}
