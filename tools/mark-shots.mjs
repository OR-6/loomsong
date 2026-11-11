// Captures the landing's nameplate mark at moments through its weaving (review helper; env OUT).
export default async function run({ context }) {
  const out = process.env.OUT;
  const p = await context.newPage();
  await p.setViewportSize({ width: 1200, height: 700 });
  await p.goto('https://localhost:8081/?review=1', { waitUntil: 'load' });
  const times = [700, 1500, 2600, 4200, 6000, 8300, 9600, 12500];
  const shots = [];
  let prev = 0;
  for (const t of times) {
    await p.waitForTimeout(t - prev);
    prev = t;
    const f = `${out}/mark-${t}.png`;
    await p.locator('.plate').screenshot({ path: f });
    shots.push(f);
  }
  await p.close();
  return shots;
}
