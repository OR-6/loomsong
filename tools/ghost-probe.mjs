// Reports the ghost hand's key joints in loom-local space (dev helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const root = g.view.root;
    const ghost = g.view.ghost.root;
    const V = root.position.constructor;
    const loc = (n) => { const o = ghost.getObjectByName(n); if (!o) return null; const p = o.getWorldPosition(new V()); return root.worldToLocal(p).toArray().map((x) => +x.toFixed(4)); };
    return { visible: ghost.visible, at: ghost.position.toArray().map((x) => +x.toFixed(4)), wrist: loc('wrist'), middleKnuckle: loc('middle-finger-phalanx-proximal'), indexKnuckle: loc('index-finger-phalanx-proximal'), pinkyKnuckle: loc('pinky-finger-phalanx-proximal'), indexTip: loc('index-finger-tip'), thumbTip: loc('thumb-tip') };
  });
}
