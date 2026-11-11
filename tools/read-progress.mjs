// The saved progress (E2E helper).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.includes('progress'));
    return k ? JSON.parse(localStorage.getItem(k)) : null;
  });
}
