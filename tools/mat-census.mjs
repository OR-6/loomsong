// Material census of the loom view: type, roughness, metalness, clearcoat, sheen, envMapIntensity (diagnostics).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const out = {};
    window.__loom.game.view.root.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        const k = `${m.type}|${m.name || '-'}|r${(m.roughness ?? -1).toFixed(2)}|m${(m.metalness ?? -1).toFixed(2)}|cc${m.clearcoat ?? '-'}|sh${m.sheen ?? '-'}|sp${m.specularIntensity ?? '-'}|env${m.envMapIntensity ?? '-'}`;
        out[k] = (out[k] ?? 0) + 1;
      }
    });
    return out;
  });
}
