// In-headset settings tags (E2E helper): SET_ACTION = open | toggle<N> | state.
export default async function run({ page, frame }) {
  const action = process.env.SET_ACTION ?? 'state';
  return await (frame ?? page).evaluate(async (action) => {
    const g = window.__loom.game;
    const c = g.controller;
    if (action === 'open') c.hooks.setting?.(0);
    const m = action.match(/^toggle(\d)$/);
    if (m) c.hooks.setting?.(Number(m[1]));
    await new Promise((r) => setTimeout(r, 300));
    const s = JSON.parse(localStorage.getItem('loomsong:settings.v1') || '{}');
    return { open: g.setOpen, spots: c.settingSpots.map((p) => !!p), texts: g.setLabels.map((l) => l.text), hc: !!s.highContrast, calm: s.calmMotion, ear: s.hearRows, look: !!s.lookToPlay };
  }, action);
}
