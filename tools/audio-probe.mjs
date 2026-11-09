// Reports whether the recorded samples loaded and decoded (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const a = window.__loom.audio;
    a.resume();
    await new Promise((r) => setTimeout(r, 1500));
    const names = [...a.bufs.keys()];
    return { missing: [...['glock-gliss','tick-0','tick-1','tick-2','flip-0','cloth-0','soft-0','plank-0','wood-medium-0','wood-light-0'].map((n) => 'fx/' + n + '.ogg')].filter((n) => !a.bufs.has(n)), ctx: a.ctx?.state ?? null, loaded: names.length, kalimba: names.filter((n) => n.startsWith('kalimba')).length, sample: names.slice(0, 3), dur: a.bufs.get('kalimba/k59.ogg')?.duration };
  });
}
