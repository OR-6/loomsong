// Occluder instance counts per hand.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const o = window.__occluders;
    return { left: o.meshes.left.count, right: o.meshes.right.count, enabled: o.state.enabled };
  });
}
