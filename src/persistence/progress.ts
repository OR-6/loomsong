/** Player progress, persisted with the guarded storage wrapper. */
import { load, save } from './storage.js';

export interface Progress {
  level: number;
  best: Record<string, number>;
  tutorialDone: boolean;
  /** Chosen visual theme (only 'workshop' once unlocked). */
  theme: 'toy' | 'workshop';
  /** Most recently finished cloth (for the share card). */
  lastCloth?: { tieUp: number[]; rows: number[]; rootMidi: number };
}

/** Workshop unlocks when the Garden chapter (the first four pictures) is done. */
export const WORKSHOP_UNLOCK = ['sprout', 'tulip', 'duck'];

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
    [...x.tieUp, ...x.rows].every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    x.rows.length > 0 &&
    x.rows.length <= 12 &&
    typeof x.rootMidi === 'number'
  );
}
