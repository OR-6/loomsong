// The Look to play ring (E2E). LOOK_WATCH=1: watch it in the page for up to 2.5 s (a look presses in about a
// second, faster than separate CLI calls can sample) and report every bead count seen; else one sample.
export default async function run({ page, frame }) {
  const watch = process.env.LOOK_WATCH === '1';
  const enable = process.env.LOOK_ENABLE === '1';
  return await (frame ?? page).evaluate(async ([watch, enable]) => {
    const d = window.__loom?.game?.view?.gazeDot;
    if (!d) return null;
    if (enable) {
      // turn Look to play on from inside the page, so the watch sees the look from its very start
      const st = JSON.parse(localStorage.getItem('loomsong:settings.v1') || '{}');
      localStorage.setItem('loomsong:settings.v1', JSON.stringify({ ...st, lookToPlay: true }));
      window.dispatchEvent(new CustomEvent('loomsong:settings'));
    }
    const sample = () => ({ visible: d.visible, beads: d.children.filter((b) => b.visible).length });
    if (!watch) return sample();
    const seen = [];
    for (let i = 0; i < 125; i++) {
      const s = sample();
      if (s.visible && seen.at(-1) !== s.beads) seen.push(s.beads);
      await new Promise((r) => setTimeout(r, 20));
    }
    return { visible: seen.length > 0, beads: Math.max(0, ...seen), seen };
  }, [watch, enable]);
}
