// Reports Pip's boat bottom vs its perch pad top (loom-local), at rest (dev helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const root = g.view.root;
    const V = root.position.constructor;
    const boat = g.view.shuttle.getObjectByName('Boat');
    const box = new (window.__loom.game.view.root.constructor.prototype.constructor === undefined ? Object : Object)();
    void box;
    // sample over ~3 s (Pip idles: hops and looks around) and keep the lowest
    boat.geometry.computeBoundingBox();
    let lowest = Infinity;
    let lo, hi;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const bb = boat.geometry.boundingBox.clone().applyMatrix4(boat.matrixWorld);
      const a = root.worldToLocal(bb.min.clone());
      const b = root.worldToLocal(bb.max.clone());
      const y = Math.min(a.y, b.y);
      if (y < lowest) { lowest = y; lo = a; hi = b; }
    }
    const pad = root.getObjectByName('PerchPadL');
    pad.geometry.computeBoundingBox();
    const pb = pad.geometry.boundingBox.clone().applyMatrix4(pad.matrixWorld);
    const padTop = root.worldToLocal(pb.max.clone()).y;
    return { boatBottomY: +lowest.toFixed(4), padTopY: +padTop.toFixed(4), boatX: [+lo.x.toFixed(3), +hi.x.toFixed(3)], shuttleT: g.controller.shuttle.t };
  });
}
