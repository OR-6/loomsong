// Clicks every 2D landing control and reports what happened.
export default async function run({ page, frame }) {
  const t = frame ?? page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await t.evaluate(() => location.reload());
  await page.waitForTimeout(500);
  // the dev server serves modules unbundled: wait for the page rather than a fixed time
  for (let i = 0; i < 60; i++) {
    const up = await t.evaluate(() => !!document.getElementById('share-card')).catch(() => false);
    if (up) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(300);
  const ids = ['enter-xr', 'hc', 'calm', 'fit', 'hand-pick', 'coop', 'coop-host', 'coop-code', 'coop-join', 'share-card', 'style-pick'];
  const missing = await t.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), ids);
  const settings = () => t.evaluate(() => JSON.parse(localStorage.getItem('loomsong:settings.v1') || '{}'));
  await t.click('#hc');
  const hcOn = (await settings()).highContrast;
  await t.click('#hc');
  const hcOff = (await settings()).highContrast;
  await t.click('#fit');
  const fit = (await settings()).calibrateNext;
  await t.click('#fit');
  await t.click('#hand-pick button[data-hand="left"]');
  const hand = (await settings()).hand;
  await t.click('#hand-pick button[data-hand="auto"]');
  const coopOpen = await t.evaluate(() => !!document.getElementById('coop-join').offsetParent); // always open now (calls start from the toy telephone)
  await t.fill('#coop-code', 'zz');
  await t.click('#coop-join');
  await page.waitForTimeout(300);
  const badCode = await t.evaluate(() => document.getElementById('coop-status').textContent);
  return { errors, missing, hcOn, hcOff, fit, hand, coopOpen, badCode };
}
