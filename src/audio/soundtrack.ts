/**
 * The game's soundtrack: one recorded, human-composed track per chapter
 * (credits in public/audio/CREDITS.md). Each entry gives the track's key so the
 * game's own voices (every thread, every row, every plush's song) are tuned to
 * it and always sit in harmony with the music; and, when known, its tempo and
 * first downbeat so a row thrown on the beat can be rewarded.
 *
 * Empty for a chapter: the built-in music box plays instead.
 */
export interface Track {
  /** File under public/audio/ (Ogg Opus). */
  file: string;
  /** The track's tonic as a MIDI note (the game's pentatonic threads are built on it). */
  keyMidi: number;
  /** Mix level under the threads (0..1). */
  gain: number;
  /** Beats per minute and the time of the first downbeat (s), if known: enables on-beat rewards. */
  bpm?: number;
  firstBeat?: number;
}

export const SOUNDTRACK: Partial<Record<string, Track>> = {};

/** The key the game plays in for a chapter: the track's tonic, near the level's own register. */
export function keyFor(chapter: string | undefined, levelRoot: number): number {
  const t = chapter ? SOUNDTRACK[chapter] : undefined;
  if (!t) return levelRoot;
  // the same pitch class as the track, in the octave closest to the level's root
  let m = t.keyMidi;
  while (m - levelRoot > 6) m -= 12;
  while (levelRoot - m > 6) m += 12;
  return m;
}
