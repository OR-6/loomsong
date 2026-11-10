// Performance snapshot: draw calls/triangles per eye-frame, shadow casters, and CPU ms per frame of the game update (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const r = g.renderer;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    await sleep(300);
    let meshes = 0, casters = 0, transparent = 0, inst = 0;
    g.view.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      meshes++;
      if (o.castShadow) casters++;
      if (o.material?.transparent) transparent++;
      if (o.isInstancedMesh) inst++;
    });
    // time the game system's update over many frames
    const sys = g;
    const t0 = performance.now();
    const N = 300;
    for (let i = 0; i < N; i++) sys.update(1 / 72);
    const cpu = (performance.now() - t0) / N;
    // frame times from rAF
    const times = [];
    let last = performance.now();
    await new Promise((done) => {
      const tick = () => { const n = performance.now(); times.push(n - last); last = n; if (times.length < 120) requestAnimationFrame(tick); else done(); };
      requestAnimationFrame(tick);
    });
    times.sort((a, b) => a - b);
    const i = r.info;
    return {
      calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures,
      visibleMeshes: meshes, shadowCasters: casters, transparent, instanced: inst, shadowMap: r.shadowMap.enabled,
      gameUpdateMs: +cpu.toFixed(3), rafMedianMs: +times[60].toFixed(2), rafP95Ms: +times[114].toFixed(2), xr: r.xr.isPresenting,
    };
  });
}
