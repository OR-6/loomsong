// Screenshots the landing page in a fresh tab at a given size (env W, H, SHOT; optional SCROLL px).
export default async function run({ context }) {
  const w = +(process.env.W || 390), h = +(process.env.H || 844);
  const p = await context.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.goto('https://localhost:8081/?shot=1', { waitUntil: 'load' });
  await p.waitForTimeout(5200); // let the hero finish weaving
  if (process.env.SCROLL) await p.evaluate((y) => document.getElementById('landing').scrollTo(0, y), +process.env.SCROLL);
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.env.SHOT });
  await p.close();
  return { ok: true };
}
