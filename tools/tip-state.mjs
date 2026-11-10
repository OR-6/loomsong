// The hover tooltip's state (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    return { visible: g.tip.mesh.visible, text: g.tip.text, hover: JSON.parse(JSON.stringify(g.controller.hover)) };
  });
}
