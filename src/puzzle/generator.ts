/**
 * Seeded level generator: solvable by construction.
 * 1. random tie-up (L distinct, non-zero, non-full lever masks);
 * 2. random walk over lever states for R rows (each step flips 1–2 levers,
 *    never weaving an empty row);
 * 3. par = minimal flips by DP (≤ the walk's own flips).
 */
import { WARPS } from '../config.js';
import type { Level } from './levels.js';
import { computePar } from './par.js';
import type { Mask8 } from './tieup.js';

/** mulberry32: tiny deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Difficulty {
  levers: number;
  rows: number;
}

/** Difficulty ramp for level index i (0-based); authored levels are 0–2. */
export function difficultyFor(i: number): Difficulty {
  if (i <= 3) return { levers: 3, rows: 6 };
  if (i <= 5) return { levers: 4, rows: 7 };
  return { levers: 4, rows: Math.min(12, 8 + Math.floor((i - 6) / 3)) };
}

const ADJ = ['Saffron', 'Indigo', 'Madder', 'Linen', 'Willow', 'Ember', 'Harbour', 'Meadow', 'Copper', 'Plum', 'Tide', 'Honey'];
const NOUN = ['Steps', 'Ripple', 'Ladder', 'Braid', 'Hollow', 'Lantern', 'Ridge', 'Chorus', 'Garden', 'Comb', 'Drift', 'Weave'];
/** Pentatonic-friendly roots (D, C, F, G, A, E). */
const ROOTS = [62, 60, 65, 67, 69, 64];

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function shed(tie: readonly Mask8[], state: number): Mask8 {
  let m = 0;
  for (let k = 0; k < tie.length; k++) if ((state >> k) & 1) m |= tie[k];
  return m;
}

export function generateLevel(seed: number, d: Difficulty, id = `g${seed}`): Level {
  const r = rng(seed);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  for (let attempt = 0; attempt < 200; attempt++) {
    // Tie-up: each lever lifts 2–5 warps; masks distinct.
    const tie: Mask8[] = [];
    while (tie.length < d.levers) {
      let m = 0;
      const lifts = 2 + Math.floor(r() * 4);
      while (popcount(m) < lifts) m |= 1 << Math.floor(r() * WARPS);
      if (!tie.includes(m)) tie.push(m);
    }
    // Every warp must be liftable by some lever (else a dead thread).
    if (tie.reduce((a, b) => a | b, 0) !== 0xff) continue;

    // Random walk over lever states.
    const target: Mask8[] = [];
    let state = 0;
    for (let row = 0; row < d.rows; row++) {
      let next = state;
      for (let tries = 0; tries < 20; tries++) {
        next = state ^ (1 << Math.floor(r() * d.levers));
        if (r() < 0.35) next ^= 1 << Math.floor(r() * d.levers);
        if (shed(tie, next) !== 0 && next !== 0) break;
      }
      if (shed(tie, next) === 0) next = 1;
      state = next;
      target.push(shed(tie, state));
    }
    // Interesting: at least 3 distinct rows, and not purely repeating.
    if (new Set(target).size < Math.min(3, d.rows)) continue;
    const par = computePar(tie, target);
    if (!Number.isFinite(par) || par < d.rows - 1) continue;
    return {
      id,
      name: `${pick(ADJ)} ${pick(NOUN)}`,
      tieUp: tie,
      target,
      rootMidi: pick(ROOTS),
      par,
    };
  }
  throw new Error(`generator failed for seed ${seed}`);
}
