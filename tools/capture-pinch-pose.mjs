// Captures the emulated right hand's pinch pose (bone local transforms, the hand's
// orientation relative to the loom, and the pinch point in model space) → JSON (dev helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const model = g.world.input.visualAdapters.hand.right.visual.model;
    const root = g.view.root;
    root.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    const M = root.matrixWorld.clone().invert().multiply(model.matrixWorld);
    const pos = new model.position.constructor();
    const quat = new model.quaternion.constructor();
    const scl = new model.position.constructor();
    M.decompose(pos, quat, scl);
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = { p: o.position.toArray().map((n) => +n.toFixed(5)), q: o.quaternion.toArray().map((n) => +n.toFixed(5)) };
    });
    const tip = (n) => model.getObjectByName(n).getWorldPosition(new model.position.constructor());
    const mid = tip('index-finger-tip').add(tip('thumb-tip')).multiplyScalar(0.5);
    const pinchLocal = model.worldToLocal(mid.clone());
    const gap = tip('index-finger-tip').distanceTo(tip('thumb-tip'));
    return { quat: quat.toArray().map((n) => +n.toFixed(5)), scale: scl.toArray().map((n) => +n.toFixed(4)), pinch: pinchLocal.toArray().map((n) => +n.toFixed(5)), gap: +gap.toFixed(4), bones };
  });
}
