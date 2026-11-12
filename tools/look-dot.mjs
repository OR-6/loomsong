// The Look to play dot (E2E).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const d = window.__loom?.game?.view?.gazeDot;
    return d ? { visible: d.visible, scale: Math.round(d.scale.x * 100) / 100 } : null;
  });
}
