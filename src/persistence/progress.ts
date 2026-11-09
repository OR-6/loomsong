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

/** Workshop unlocks after the three authored levels are finished. */
export const WORKSHOP_UNLOCK = ['a1', 'a2', 'a3'];

export function workshopUnlocked(p: Pick<Progress, 'best'>): boolean {
  return WORKSHOP_UNLOCK.every((id) => (p.best[id] ?? 0) > 0);
}

const KEY = 'progress.v1';

export function loadProgress(): Progress {
  const p = load<Partial<Progress>>(KEY, {});
  return {
    level: Number.isInteger(p.level) && (p.level as number) >= 0 ? (p.level as number) : 0,
    best: p.best && typeof p.best === 'object' ? p.best : {},
    tutorialDone: p.tutorialDone === true,
    theme: p.theme === 'workshop' ? 'workshop' : 'toy',
    lastCloth: validCloth(p.lastCloth) ? p.lastCloth : undefined,
  };
}

export function saveProgress(p: Progress): void {
  save(KEY, p);
}

function validCloth(c: unknown): c is NonNullable<Progress['lastCloth']> {
  const x = c as Progress['lastCloth'];
  return (
    !!x &&
    Array.isArray(x.tieUp) &&
    Array.isArray(x.rows) &&
    x.rows.length > 0 &&
    x.rows.length <= 12 &&
    typeof x.rootMidi === 'number'
  );
}
