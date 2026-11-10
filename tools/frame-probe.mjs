// Lists named frame parts' loom-local positions (dev helper for art review).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const root = g.view.root;
    const out = {};
    root.traverse((o) => {
      if (/Crank|Handle|BobbinRod|^Bobbin$|LeverBase/.test(o.name)) {
        const p = o.getWorldPosition(new o.position.constructor());
        out[o.name + '#' + o.id] = root.worldToLocal(p).toArray().map((x) => +x.toFixed(3));
      }
    });
    return { side: g.controller.bankSide, out };
  });
}
