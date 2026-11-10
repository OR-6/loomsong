// Inspects IWSDK's right-hand visual model (bones) while the emulated hand pinches (dev helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const g = window.__loom.game;
    const w = g.world;
    const inp = w.input;
    const keys = Object.keys(inp ?? {});
    const ad = inp?.visualAdapters?.hand?.right;
    const model = ad?.visual?.model;
    const bones = [];
    model?.traverse((o) => { if (o.isBone) bones.push(o.name); });
    let meshes = 0;
    model?.traverse((o) => { if (o.isSkinnedMesh) meshes++; });
    return { keys, hasAdapter: !!ad, adapterKeys: ad ? Object.keys(ad) : [], hasModel: !!model, visible: model?.visible, bones, meshes };
  });
}
