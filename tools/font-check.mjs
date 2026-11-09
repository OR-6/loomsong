// Reports which bundled display fonts are loaded in the running page.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(() => ({
    lilita: document.fonts.check("16px 'Lilita One'"),
    fraunces: document.fonts.check("16px 'Fraunces'"),
    faces: [...document.fonts].map((f) => `${f.family}:${f.status}`),
  }));
}
