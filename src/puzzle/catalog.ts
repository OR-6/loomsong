/**
 * Level sequence: 18 picture levels in 4 chapters, then bonus patterns from
 * the generator. Plus a date-seeded daily cloth.
 */
import type { Level } from './levels.js';
import { CHAPTERS, PICTURES } from './pictures.gen.js';
import { difficultyFor, generateLevel, rng } from './generator.js';

export { CHAPTERS };

export const LEVELS: Level[] = PICTURES.map((p) => ({
  id: p.id,
  name: p.name,
  tieUp: [...p.tieUp],
  target: [...p.target],
  rootMidi: p.rootMidi,
  par: p.par,
  color: p.color,
  chapter: p.chapter,
  mystery: p.mystery,
}));

const cache = new Map<number, Level>();

/** Level at 0-based index i: pictures first, then bonus patterns forever. */
export function levelAt(i: number): Level {
  if (i < LEVELS.length) return LEVELS[i];
  let l = cache.get(i);
  if (!l) {
    l = { ...generateLevel(100003 * (i + 1), difficultyFor(i), `bonus${i - LEVELS.length + 1}`), name: 'Bonus pattern' };
    cache.set(i, l);
  }
  return l;
}

export function chapterOf(level: Level): { index: number; name: string } | null {
  const i = CHAPTERS.findIndex((c) => c.id === level.chapter);
  return i < 0 ? null : { index: i, name: CHAPTERS[i].name };
}

/** Local-date key, e.g. "2026-11-10". */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DAILY_COLORS = [0xe2563b, 0x2a9d8f, 0x3d5a80, 0xd4537e, 0x534ab7, 0xf2a024, 0x2f8f5b];

/** The day's cloth: the same picture for everyone that day, in a day colour. */
export function dailyLevel(key = dayKey()): Level {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = rng(h >>> 0);
  const base = LEVELS[Math.floor(r() * LEVELS.length)];
  return {
    ...base,
    id: `daily-${key}`,
    name: base.name,
    color: DAILY_COLORS[Math.floor(r() * DAILY_COLORS.length)],
    rootMidi: 57 + Math.floor(r() * 12),
    mystery: false,
  };
}
