// Counts visible meshes under the loom by top-level group and by material (perf helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const root = g.view.root;
    const byGroup = {};
    const byMat = {};
    const names = [];
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    root.traverse((o) => {
      if (!o.isMesh || !shown(o)) return;
      let top = o;
      while (top.parent && top.parent !== root) top = top.parent;
      byGroup[top.name || top.type] = (byGroup[top.name || top.type] ?? 0) + 1;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const key = m?.name || m?.type;
      byMat[key] = (byMat[key] ?? 0) + 1;
      if (top.name === 'LoomFrame' || top.name === 'Body' || top.name === 'loom') names.push(o.name);
    });
    return { byGroup, byMat, sample: names.slice(0, 80) };
  });
}
