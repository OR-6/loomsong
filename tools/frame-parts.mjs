// The loom frame model's meshes: name, material, bounding box (loom space, m) (diagnostics).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const f = g.view.frameNode;
    const out = [];
    if (!f) return 'no frame';
    f.updateMatrixWorld(true);
    const inv = g.view.root.matrixWorld.clone().invert();
    f.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const r = (v) => Math.round(v * 1000);
      out.push(`${o.name} | ${o.material.name} | tris ${(o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3} | x ${r(b.min.x)}..${r(b.max.x)} y ${r(b.min.y)}..${r(b.max.y)} z ${r(b.min.z)}..${r(b.max.z)}`);
    });
    return out;
  });
}
