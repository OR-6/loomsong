/**
 * Level sequence: 18 picture levels in 4 chapters, then bonus patterns from
 * the generator. Plus a date-seeded daily cloth.
 */
import type { Level } from './levels.js';
import { CHAPTERS, DAILY, PICTURES } from './pictures.gen.js';
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
  weft: p.weft,
  friend: p.friend,
}));

/**
 * The grand finale's picture: once every chapter is woven, the loom weaves a
 * rose heart by itself to say thank you (the Heart's own levers, so it's always weavable).
 */
const heart = LEVELS.find((l) => l.id === 'heart')!;
export const THANKS_LEVEL: Level = { ...heart, id: 'thanks', name: 'Thank you', color: 0xd4537e, chapter: undefined, mystery: false, par: 0 }; // par 0: no move knots on its card

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

/** The pictures of the day, as levels (one a day, in order, for everyone). */
export const DAILY_LEVELS: Level[] = DAILY.map((p) => ({
  id: p.id,
  name: p.name,
  tieUp: [...p.tieUp],
  target: [...p.target],
  rootMidi: p.rootMidi,
  par: p.par,
  color: p.color,
  chapter: 'daily',
  mystery: false,
}));

/** Days since 2026-01-01 for a local-date key. */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86400000);
}

/** The day's picture: the same for everyone that day; the whole set comes round before any repeats. */
export function dailyLevel(key = dayKey()): Level {
  const n = DAILY_LEVELS.length;
  return DAILY_LEVELS[((dayNumber(key) % n) + n) % n];
}

/** Days in a row with the daily picture woven, ending today (or yesterday, if today's is still to do). */
export function streakOf(days: readonly string[], today = dayKey()): number {
  const have = new Set(days);
  let d = dayNumber(today);
  if (!have.has(today)) d--;
  let n = 0;
  const keyOf = (k: number) => new Date(Date.UTC(2026, 0, 1) + k * 86400000).toISOString().slice(0, 10);
  while (have.has(keyOf(d - n))) n++;
  return n;
}

/** Any finished picture by id: a chapter picture or a picture of the day. */
export function pictureById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id) ?? DAILY_LEVELS.find((l) => l.id === id);
}

/** Basket state of each chapter: the one being played, open, or still locked. */
export type ChapterState = 'locked' | 'open' | 'current';

/** A chapter unlocks once all but one picture of the chapter before it is woven. */
export function chapterStates(progress: { best: Record<string, number> }, current: string | undefined): ChapterState[] {
  // once the first picture is woven every chapter is open: a short visit still reaches Night's hidden
  // levers and the Sea's second yarn (each chapter starts at its own first picture)
  const started = (progress.best[CHAPTERS[0].levels[0]] ?? 0) > 0;
  return CHAPTERS.map((c, i) => {
    if (c.id === current) return 'current';
    if (i === 0 || started) return 'open';
    return 'locked';
  });
}

