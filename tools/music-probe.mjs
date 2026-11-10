// Background music: notes scheduled over 4 s, the pad present, and the mood (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const a = window.__loom.audio;
    a.resume();
    await new Promise((r) => setTimeout(r, 1500));
    const n0 = a.musicNotes;
    await new Promise((r) => setTimeout(r, 4000));
    return { ctx: a.ctx?.state ?? null, notes4s: a.musicNotes - n0, pad: !!a.pad, bpm: a.mood.bpm, bus: a.musicBus?.gain.value ?? null };
  });
}
