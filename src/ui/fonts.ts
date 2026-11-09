/**
 * Display font: Lilita One (SIL Open Font License 1.1, bundled unmodified in
 * public/fonts with its licence). Loaded before the world starts so every
 * canvas-drawn label uses it; falls back to system fonts after a timeout.
 */
export const DISPLAY_FONT = "'Lilita One', system-ui, -apple-system, sans-serif";

export async function loadFonts(timeoutMs = 1500): Promise<boolean> {
  try {
    const url = `${import.meta.env.BASE_URL}fonts/LilitaOne-Regular.ttf`;
    const face = new FontFace('Lilita One', `url(${url})`);
    const loaded = face.load().then((f) => {
      document.fonts.add(f);
      return true;
    });
    const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs));
    return await Promise.race([loaded, timeout]);
  } catch {
    return false;
  }
}
