// Inspects the cloth InstancedMesh (count, colours, first matrix, bounds).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const v = window.__loom.game.view;
    const c = v.cloth;
    const m = [...c.instanceMatrix.array.slice(0, 16)].map((x) => +x.toFixed(4));
    return {
      count: c.count, visible: c.visible, hasColor: !!c.instanceColor,
      color0: c.instanceColor ? [...c.instanceColor.array.slice(0, 3)].map((x) => +x.toFixed(3)) : null,
      matrix0: m, frustumCulled: c.frustumCulled,
      boundingSphere: c.boundingSphere ? { r: c.boundingSphere.radius, c: c.boundingSphere.center.toArray() } : null,
      geomSphere: c.geometry.boundingSphere ? c.geometry.boundingSphere.radius : null,
      rows: window.__loom.debug.rows.length,
    };
  });
}
