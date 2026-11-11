// The wall the quilts hang on, and each quilt (world positions) (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const g = window.__loom.game;
    const quilts = {};
    for (const [id, q] of g.quilts) quilts[id] = q.getWorldPosition(q.position.clone()).toArray().map((n) => +n.toFixed(3));
    const head = g.player.head.getWorldPosition(g.tmp.clone()).toArray().map((n) => +n.toFixed(3));
    return { wall: g.debug.wall ?? null, quilts, flying: g.quiltFly?.id ?? null, visible: g.quiltRoot.visible, head, notice: g.debug.notice };
  });
}
