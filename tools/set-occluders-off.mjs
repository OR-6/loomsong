// Disables hand occluders (before/after comparison).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => { window.__occluders.state.enabled = false; return 'off'; });
}
