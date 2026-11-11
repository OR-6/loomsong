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

/**
 * Scott Buckley (scottbuckley.com.au), CC BY 4.0. Keys measured from the
 * recordings (tools: chroma vs key profiles); a minor-key track uses its
 * relative major, whose pentatonic is the same five notes as the minor's.
 * Tempo is not given: the estimates weren't reliable, so no on-beat reward
 * is claimed on a recorded track.
 */
export const SOUNDTRACK: Partial<Record<string, Track>> = {
  garden: { file: 'music/garden-castles-in-the-sky.ogg', keyMidi: 66, gain: 0.5 }, // D♯ minor → F♯ major
  home: { file: 'music/home-home-was-you.ogg', keyMidi: 60, gain: 0.5 }, // C major
  night: { file: 'music/night-sleep.ogg', keyMidi: 57, gain: 0.55 }, // A major
  sea: { file: 'music/sea-solace.ogg', keyMidi: 65, gain: 0.5 }, // D minor → F major
  // the picture of the day: the bright Garden piece
  daily: { file: 'music/garden-castles-in-the-sky.ogg', keyMidi: 66, gain: 0.5 },
};

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
