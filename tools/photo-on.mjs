// Turns the capture-only photo set on (env PHOTO=0 turns it off).
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate((on) => { window.__loom.photo(on); return on; }, process.env.PHOTO !== '0');
}
