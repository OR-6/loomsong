// Perf census of a busy desk: Night shelf full, ten plushes on the desk, the friend cushion, phone and present.
// Reports the renderer's draw calls and triangles for a frame, and the scene's mesh count (diagnostics).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    g.controller.releaseAll();
    const s = g.controller.bankSide;
    for (const id of ['sprout', 'tulip', 'duck', 'table', 'cup', 'heart', 'house', 'star', 'table', 'moon', 'ghost', 'owl', 'cat']) g.progress.best[id] = 3;
    g.progress.tutorialDone = true;
    const spots = [[0.2, 0.19], [0.29, 0.18], [-0.42, 0.12], [0.44, 0.09], [0.13, 0.2], [-0.46, 0.05], [0.5, 0.03], [-0.5, -0.03], [0.42, -0.08], [-0.25, 0.24]];
    const ids = ['sprout', 'tulip', 'duck', 'cup', 'heart', 'house', 'star', 'table', 'day-bell', 'day-pine'];
    g.progress.placed = Object.fromEntries(ids.map((id, i) => [id, [s * spots[i][0], spots[i][1]]]));
    g.progress.best['day-bell'] = 2;
    g.progress.best['day-pine'] = 2;
    g.flow.start(12); // the Lantern: cushion out
    await sleep(1500);
    const info = g.renderer.info;
    const samples = [];
    for (let k = 0; k < 20; k++) {
      await new Promise((r) => requestAnimationFrame(r));
      samples.push([info.render.calls, info.render.triangles]);
    }
    let meshes = 0;
    g.world.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
    const max = samples.reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])], [0, 0]);
    return { level: g.flow.level.id, calls: max[0], triangles: max[1], visibleMeshes: meshes, geometries: info.memory.geometries, textures: info.memory.textures, deskIds: Array.from({ length: 45 }, (_, i) => g.view.plushes.idAt(i)).filter(Boolean).length };
  });
}
