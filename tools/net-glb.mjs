// Lists model resources (glb/gltf) the page fetched.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name).filter((u) => /glb|gltf|profiles/.test(u)));
}
