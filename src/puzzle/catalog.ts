/**
 * Level sequence: 18 picture levels in 4 chapters, then bonus patterns from
 * the generator. Plus a date-seeded daily cloth.
 */
import type { Level } from './levels.js';
import { CHAPTERS, DAILY, PICTURES } from './pictures.gen.js';
import { difficultyFor, generateLevel, rng } from './generator.js';
import { computePar } from './par.js';

export { CHAPTERS };

/**
 * Mend the cloth: `level` arrives with `woven` rows already on the loom, row `wrong` of them wrong (the
 * threads of a neighbouring row, its yarn kept). Find it, unpick back to it, weave on. Par counts the
 * reweave only (unpicking is free).
 */
export function mendLevel(level: Level, woven: number, wrong: number): Level {
  const t = level.target;
  woven = Math.max(2, Math.min(woven, t.length - 1));
  wrong = Math.max(0, Math.min(wrong, woven - 2)); // never the top row: there's always one to unpick past
  let bad = -1;
  for (const k of [wrong + 1, wrong - 1, wrong + 2, wrong + 3]) if (k >= 0 && k < t.length && (t[k] & 255) !== (t[wrong] & 255)) { bad = t[k] & 255; break; }
  if (bad < 0) bad = (t[wrong] & 255) ^ level.tieUp[0] || level.tieUp[0];
  const rows = t.slice(0, woven);
  rows[wrong] = bad | (t[wrong] & 256);
  return { ...level, mend: rows, par: computePar(level.tieUp, t.slice(wrong), !!level.mystery, level.hideFrom ?? 0) };
}

/** Night eases in: its first pictures hide only their last levers (the Moon two of four, the Ghost three). */
const EASE_IN: Readonly<Record<string, number>> = { moon: 2, ghost: 1 };

/** Chapter pictures that arrive tangled (woven, wrong): one mid-chapter twist each in Night and the Sea. */
const MENDED: Readonly<Record<string, [number, number]>> = { owl: [4, 1], octopus: [4, 1] };

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
}))
  .map((l) => (EASE_IN[l.id] ? { ...l, hideFrom: EASE_IN[l.id], par: computePar(l.tieUp, l.target, true, EASE_IN[l.id]) } : l))
  .map((l) => (MENDED[l.id] ? mendLevel(l, MENDED[l.id][0], MENDED[l.id][1]) : l));

/**
 * The grand finale's picture: once every chapter is woven, the loom weaves a
 * rose heart by itself to say thank you (the Heart's own levers, so it's always weavable).
 */
const heart = LEVELS.find((l) => l.id === 'heart')!;
export const THANKS_LEVEL: Level = { ...heart, id: 'thanks', name: 'Thank you', color: 0xd4537e, chapter: undefined, mystery: false, par: 0 }; // par 0: no move knots on its card

const cache = new Map<number, Level>();

/**
 * Level at 0-based index i: the pictures, then (after the finale) the pictures again from the start,
 * to weave for gold with what you know now (never random, nameless patterns).
 */
export function levelAt(i: number): Level {
  if (i < LEVELS.length) return LEVELS[i];
  const k = i - LEVELS.length;
  let l = twisted.get(k);
  if (!l) {
    l = twist(LEVELS[k % LEVELS.length], Math.floor(k / LEVELS.length) + k);
    twisted.set(k, l);
  }
  return l;
}

/** Replays (after the last picture, or chasing gold) come with a twist, so a picture you know plays anew. */
const twisted = new Map<number, Level>();
export type Twist = 'tangled' | 'tide' | 'hidden';
const TWISTS: readonly Twist[] = ['tangled', 'tide', 'hidden'];
export function twist(base: Level, n: number): Level {
  if (base.friend || base.mend) return base; // a friend picture's puzzle is its friend; a tangled one already is
  return withTwist(base, TWISTS[((n % TWISTS.length) + TWISTS.length) % TWISTS.length]);
}
export function withTwist(base: Level, t: Twist | 'plain'): Level {
  if (t === 'tangled') return mendLevel(base, Math.min(4, base.target.length - 2), 1);
  if (t === 'tide') return { ...base, tide: true };
  if (t === 'hidden') return { ...base, mystery: true, hideFrom: 0, par: computePar(base.tieUp, base.target, true, 0) };
  return base;
}

/** A random pattern (the Workshop's own), kept for tools and tests. */
export function bonusLevel(i: number): Level {
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

/**
 * What kind of puzzle the picture of the day is, in a four-day turn: plain, tangled (mend it), hidden
 * levers (Night's rule), the tide (the card two rows at a time). Each needs its chapter met first.
 */
export function dayKind(key: string): Twist | 'plain' {
  return (['plain', 'tangled', 'hidden', 'tide'] as const)[((dayNumber(key) % 4) + 4) % 4];
}

/** The day's picture: the same for everyone that day; the whole set comes round before any repeats. */
export function dailyLevel(key = dayKey()): Level {
  const n = DAILY_LEVELS.length;
  return DAILY_LEVELS[((dayNumber(key) % n) + n) % n];
}

/**
 * Visitors: each picture of the day likes a chapter plush. Leave that plush out on your desk and,
 * on a new day, the visitor comes to see it, bringing the present (your desk decides who comes).
 */
export const VISITOR_LIKES: Readonly<Record<string, string>> = {
  'day-ladybug': 'sprout',
  'day-butterfly': 'tulip',
  'day-frog': 'duck',
  'day-mushroom': 'table',
  'day-gift': 'heart',
  'day-key': 'house',
  'day-rocket': 'star',
  'day-icecream': 'cup',
  'day-snowman': 'moon',
  'day-bell': 'ghost',
  'day-acorn': 'owl',
  'day-rabbit': 'cat',
  'day-candle': 'lantern',
  'day-sun': 'crab',
  'day-pine': 'fish',
  'day-jelly': 'jellyfish',
  'day-robot': 'octopus',
  'day-crown': 'house',
  'day-bear': 'heart',
  'day-pear': 'tulip',
  'day-boot': 'duck',
  'day-arrow': 'star',
  'day-flag': 'house',
  'day-snail': 'sprout',
  'day-whale': 'fish',
  'day-anchor': 'boat',
};

/**
 * Today's visitor: one who likes a plush standing on your desk and hasn't been woven yet,
 * chosen by the day so it's stable; null when no plush you've left out has a visitor.
 */
export function visitorFor(key: string, onDesk: readonly string[], woven: (id: string) => boolean): Level | null {
  const desk = new Set(onDesk);
  const all = Object.keys(VISITOR_LIKES).filter((v) => desk.has(VISITOR_LIKES[v]));
  if (!all.length) return null;
  // only a visitor you haven't woven yet: once they've all been, the day's own picture comes instead
  const pool = all.filter((v) => !woven(v)).sort();
  if (!pool.length) return null;
  const n = dayNumber(key);
  const id = pool[((n % pool.length) + pool.length) % pool.length];
  return DAILY_LEVELS.find((l) => l.id === id) ?? null;
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

