// The recorded soundtrack: which track plays, its load state, the game's key, and the bus (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const a = window.__loom.audio;
    const g = window.__loom.game;
    a.resume();
    await new Promise((r) => setTimeout(r, 4000));
    const states = {};
    for (const [k, v] of a.trackBufs) states[k] = typeof v === 'string' ? v : `${v.duration.toFixed(1)}s`;
    return { ctx: a.ctx?.state ?? null, chapter: a.chapter, track: a.track?.name ?? null, trackGain: a.track ? +a.track.gain.gain.value.toFixed(3) : null, loads: states, root: a.rootMidi, level: g.flow.level.id, pad: !!a.pad };
  });
}
