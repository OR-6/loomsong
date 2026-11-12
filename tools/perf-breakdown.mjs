// Where the draw calls go: visible meshes grouped by owner (top-level loom part or plush) and shadow casting,
// plus the frame's calls with shadows on and off (diagnostics; run after tools/perf-census.mjs).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const info = g.renderer.info;
    const frameCalls = async () => {
      let m = 0;
      for (let k = 0; k < 8; k++) {
        await new Promise((r) => requestAnimationFrame(r));
        m = Math.max(m, info.render.calls);
      }
      return m;
    };
    const withShadows = await frameCalls();
    const was = g.renderer.shadowMap.enabled;
    g.renderer.shadowMap.enabled = false;
    const without = await frameCalls();
    g.renderer.shadowMap.enabled = was;
    const groups = {};
    let casters = 0;
    const root = g.view.root;
    root.traverse((o) => {
      if (!o.isMesh) return;
      let v = true;
      for (let p = o; p; p = p.parent) if (!p.visible) v = false;
      if (!v) return;
      if (o.castShadow) casters++;
      let top = o;
      while (top.parent && top.parent !== root) top = top.parent;
      let key = top.name || top.type;
      if (key === 'Plushes' || /plush/i.test(key)) {
        let p = o;
        while (p.parent && p.name !== 'Plush') p = p.parent;
        key = 'plush parts';
      }
      groups[key] = (groups[key] ?? 0) + 1;
    });
    let sceneMeshes = 0;
    g.world.scene.traverse((o) => { if (o.isMesh) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (v) sceneMeshes++; } });
    return { withShadows, without, casters, sceneMeshes, groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 14) };
  });
}
