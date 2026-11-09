// Lists every non-local resource the page has fetched (resource timing).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() =>
    performance.getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => !/^(https?:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(u))
  );
}
