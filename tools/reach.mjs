// Distance (m) from the seated head's shoulder point to every interactable (diagnostics: reach claims).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const L = window.__loom;
    const t = L.targets();
    const head = L.game.world.camera.getWorldPosition(new L.game.tmp2.constructor());
    const sh = [head.x, head.y - 0.25, head.z]; // the shoulders, a hand-width below the eyes
    const out = {};
    for (const [k, v] of Object.entries(t)) if (Array.isArray(v) && v.length === 3) out[k] = Math.round(Math.hypot(v[0] - sh[0], v[1] - sh[1], v[2] - sh[2]) * 100);
    return out;
  });
}
