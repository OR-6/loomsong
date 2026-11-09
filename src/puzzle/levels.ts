/**
 * Level definitions. Levels 1–3 are authored for tutorial quality; later
 * levels come from the generator (M2).
 */
import type { Mask8 } from './tieup.js';

export interface Level {
  id: string;
  /** Lever → warp mask; 2–4 levers. */
  tieUp: Mask8[];
  /** Target rows in weaving order (row 0 nearest the user). */
  target: Mask8[];
  /** MIDI root for the pentatonic warp scale. */
  rootMidi: number;
  /** Minimal lever flips (computed; see par.ts). */
  par: number;
  /** Short ≤ 5-word name shown on the card. */
  name: string;
}

export const AUTHORED: Omit<Level, 'par'>[] = [
  {
    // Teaches: one lever, pass, pass again; then both; then swap.
    id: 'a1',
    name: 'First Thread',
    tieUp: [0b00111100, 0b11000011],
    target: [0b00111100, 0b00111100, 0b11111111, 0b11000011],
    rootMidi: 62,
  },
  {
    // Halves and a centre stripe: three levers.
    id: 'a2',
    name: 'Halves',
    tieUp: [0b00001111, 0b11110000, 0b00011000],
    target: [0b00001111, 0b00011111, 0b11110000, 0b11111000, 0b00011000, 0b11111111],
    rootMidi: 60,
  },
  {
    // A 2/2 twill: the diagonal everyone recognises.
    id: 'a3',
    name: 'Twill',
    tieUp: [0b00110011, 0b01100110, 0b11001100, 0b10011001],
    target: [0b00110011, 0b01100110, 0b11001100, 0b10011001, 0b00110011, 0b01100110],
    rootMidi: 65,
  },
];
