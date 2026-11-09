/**
 * Picture levels: every level weaves a little 8-wide pixel picture, and the
 * lifted threads (the picture's pixels) are the notes of its song.
 * Data lives in pictures.gen.ts (built by tools/derive-tieups.mjs).
 */
import type { Mask8 } from './tieup.js';

export interface PictureLevel {
  id: string;
  name: string;
  chapter: string;
  /** Hide which threads each lever lifts until it's been tried once. */
  mystery: boolean;
  /** Yarn colour of the picture's pixels (lifted warps). */
  color: number;
  /** Rows top→bottom, '#' = pixel. */
  picture: string[];
  tieUp: Mask8[];
  /** Weaving order: bottom row first. */
  target: Mask8[];
  par: number;
  rootMidi: number;
}

export interface Chapter {
  id: string;
  name: string;
  idea: string;
  levels: string[];
}
