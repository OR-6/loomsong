// Frame-guard state and the emulator's effective frame interval.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const t0 = performance.now();
    let n = 0;
    await new Promise((res) => { const s = g.world.session; const tick = () => { n++; if (performance.now() - t0 > 1000) res(); else s.requestAnimationFrame(tick); }; s.requestAnimationFrame(tick); });
    return { degrade: window.__loom.debug.degrade, ema: g.guard.ema, level: g.guard.level, measuredFps: n, targetHz: g.world.session?.frameRate };
  });
}
