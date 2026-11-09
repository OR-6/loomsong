// Reports renderer stats for the current frame (draw calls, triangles).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const r = g.renderer;
    await new Promise((res) => setTimeout(res, 300));
    const i = r.info;
    let meshes = 0;
    g.view.root.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, loomVisibleMeshes: meshes, autoReset: r.info.autoReset, xr: r.xr.isPresenting };
  });
}
