// The Look to play ring (E2E): shown, and how many beads are filled.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const d = window.__loom?.game?.view?.gazeDot;
    return d ? { visible: d.visible, beads: d.children.filter((b) => b.visible).length } : null;
  });
}
