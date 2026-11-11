// The toy telephone (world), its tag state and the co-op status (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const L = window.__loom;
    const g = L.game;
    const m = g.view.root.matrixWorld;
    const d = g.controller.phoneSpot;
    return {
      phone: d ? d.clone().applyMatrix4(m).toArray() : null,
      visible: g.view.phone.root.visible,
      state: g.view.phone.phoneState,
      tag: g.view.phone.tag.text,
      coop: L.coop.status,
      notice: g.debug.notice,
    };
  });
}
