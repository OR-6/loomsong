/**
 * Level sequence: authored levels 1–3, then generated levels forever.
 * Levels 4–6 use fixed seeds (the same for every player); later levels are
 * seeded by their index, so the sequence is deterministic.
 */
import { AUTHORED, type Level } from './levels.js';
import { computePar } from './par.js';
import { difficultyFor, generateLevel } from './generator.js';

export const LEVELS: Level[] = AUTHORED.map((l) => ({ ...l, par: computePar(l.tieUp, l.target) }));

const FIXED_SEEDS = [4041, 5052, 6063];
const cache = new Map<number, Level>();

/** Level at 0-based index i (authored, then generated). */
export function levelAt(i: number): Level {
  if (i < LEVELS.length) return LEVELS[i];
  let l = cache.get(i);
  if (!l) {
    const g = i - LEVELS.length;
    const seed = g < FIXED_SEEDS.length ? FIXED_SEEDS[g] : 100003 * (i + 1);
    l = generateLevel(seed, difficultyFor(i), `g${i + 1}`);
    cache.set(i, l);
  }
  return l;
}
