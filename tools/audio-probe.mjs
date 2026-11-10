// Reports which recorded samples loaded and decoded (E2E/debug).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const a = window.__loom.audio;
    a.resume();
    await new Promise((r) => setTimeout(r, 2000));
    const names = [...a.bufs.keys()];
    const index = await fetch('/audio/index.json').then((r) => r.json()).catch(() => []);
    return { ctx: a.ctx?.state ?? null, loaded: names.length, listed: index.length, missing: index.filter((n) => !a.bufs.has(n)), pip: names.filter((n) => n.includes('pip-')) };
  });
}
