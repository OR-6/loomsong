// Returns saved settings and progress (E2E assertions).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => ({
    settings: JSON.parse(localStorage.getItem('loomsong:settings.v1') || 'null'),
    progress: JSON.parse(localStorage.getItem('loomsong:progress.v1') || 'null'),
    hash: location.hash,
  }));
}
