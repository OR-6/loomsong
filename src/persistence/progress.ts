/** Player progress, persisted with the guarded storage wrapper. */
import { load, save } from './storage.js';

export interface Progress {
  level: number;
  best: Record<string, number>;
  tutorialDone: boolean;
  /** Chosen visual theme (only 'workshop' once unlocked). */
  theme: 'toy' | 'workshop';
  /** Most recently finished cloth (for the share card). */
  lastCloth?: { tieUp: number[]; rows: number[]; rootMidi: number; color?: number; weft?: number };
  /** Plushes set down on the real desk: picture id → [x, z] in loom space (m). */
  placed?: Record<string, [number, number]>;
  /** Where the loom stood, relative to the room's persistent anchor (resumed next session). */
  loom?: SavedLoom;
  /** The picture on the loom when you left, and its rows so far: you carry on there next time. */
  wip?: { level: string; rows: number[] };
  /** Days the picture of the day was woven (local-date keys, newest last). */
  days?: string[];
  /** Today's picture of the day, chosen once a day (a visitor for a plush on your desk, or the day's own). */
  dailyPick?: { day: string; id: string };
  /** When the player was last at the loom (ms since 1970): a long while away and Pip is asleep. */
  lastSeen?: number;
  /** The grand finale has played (it plays once; replaying a chapter doesn't bring it back). */
  grandSeen?: boolean;
}

export interface SavedLoom {
  /** The persistent anchor's handle: only that same anchor can bring the loom back. */
  uuid: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  side: 1 | -1;
  source: 'palm' | 'plane' | 'default' | 'fixed';
}

/** The Workshop look unlocks a little into Home (one new thing at a time, never during Garden). */
export const WORKSHOP_UNLOCK = ['sprout', 'tulip', 'duck', 'table', 'heart', 'house', 'star', 'cup'];

export function workshopUnlocked(p: Pick<Progress, 'best'>): boolean {
  return WORKSHOP_UNLOCK.every((id) => (p.best[id] ?? 0) > 0);
}

const KEY = 'progress.v1';

export function loadProgress(): Progress {
  const raw = load<unknown>(KEY, {});
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Progress>;
  return {
    level: Number.isInteger(p.level) && (p.level as number) >= 0 ? (p.level as number) : 0,
    best: validBest(p.best),
    tutorialDone: p.tutorialDone === true,
    theme: p.theme === 'workshop' ? 'workshop' : 'toy',
    lastCloth: validCloth(p.lastCloth) ? p.lastCloth : undefined,
    wip:
      p.wip && typeof p.wip.level === 'string' && Array.isArray(p.wip.rows) && p.wip.rows.length <= 12 && p.wip.rows.every((r) => Number.isInteger(r) && r >= 0 && r <= 511)
        ? { level: p.wip.level, rows: [...p.wip.rows] }
        : undefined,
    placed: validPlaced(p.placed),
    loom: validLoom(p.loom),
    lastSeen: typeof p.lastSeen === 'number' && Number.isFinite(p.lastSeen) ? p.lastSeen : undefined,
    grandSeen: p.grandSeen === true ? true : undefined,
    dailyPick: p.dailyPick && typeof p.dailyPick.day === 'string' && typeof p.dailyPick.id === 'string' && /^day-[a-z]+$/.test(p.dailyPick.id) ? { day: p.dailyPick.day, id: p.dailyPick.id } : undefined,
    days: Array.isArray(p.days) ? p.days.filter((d) => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d)).slice(-400) : undefined,
  };
}

export function saveProgress(p: Progress): void {
  save(KEY, p);
}

function validBest(b: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!b || typeof b !== 'object') return out;
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3) out[k] = v;
  }
  return out;
}

function validCloth(c: unknown): c is NonNullable<Progress['lastCloth']> {
  const x = c as Progress['lastCloth'];
  return (
    !!x &&
    Array.isArray(x.tieUp) &&
    Array.isArray(x.rows) &&
    x.tieUp.length >= 1 &&
    x.tieUp.length <= 4 &&
    x.tieUp.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    x.rows.every((v) => Number.isInteger(v) && v >= 0 && v <= 511) && // bit 8: a row in the second yarn (the Sea)
    (x.color === undefined || (Number.isInteger(x.color) && x.color >= 0 && x.color <= 0xffffff)) &&
    (x.weft === undefined || (Number.isInteger(x.weft) && x.weft >= 0 && x.weft <= 0xffffff)) &&
    x.rows.length > 0 &&
    x.rows.length <= 12 &&
    typeof x.rootMidi === 'number'
  );
}

function validPlaced(v: unknown): Record<string, [number, number]> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: Record<string, [number, number]> = {};
  for (const [k, xz] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(xz) && xz.length === 2 && xz.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 2)) out[k] = [xz[0], xz[1]];
  }
  return out;
}

function validLoom(v: unknown): SavedLoom | undefined {
  const l = v as SavedLoom | undefined;
  if (!l || typeof l !== 'object' || typeof l.uuid !== 'string' || !l.uuid) return undefined;
  if (![l.x, l.y, l.z, l.yaw].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 50)) return undefined;
  if (l.side !== 1 && l.side !== -1) return undefined;
  if (!['palm', 'plane', 'default', 'fixed'].includes(l.source)) return undefined;
  return l;
}
