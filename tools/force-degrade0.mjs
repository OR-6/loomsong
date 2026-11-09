// Forces frame-guard level 0 (occluders on) for visual checks.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    window.__loom.game.forcedDegrade = 0;
    window.__occluders.state.enabled = true;
    await new Promise((r) => setTimeout(r, 300));
    return { degrade: window.__loom.debug.degrade, enabled: window.__occluders.state.enabled };
  });
}
