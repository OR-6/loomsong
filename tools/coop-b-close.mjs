// Closes the co-op guest tab (if any).
export default async function run({ context }) {
  const b = context.pages().find((p) => p.url().includes('desk=0.75'));
  if (!b) return 'none';
  try { await b.close(); return 'closed'; } catch (e) { return 'close blocked: ' + String(e).slice(0, 120); }
}
