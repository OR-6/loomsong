/** Player progress, persisted with the guarded storage wrapper. */
import { load, save } from './storage.js';

export interface Progress {
  level: number;
  best: Record<string, number>;
  tutorialDone: boolean;
  /** Chosen visual theme (only 'workshop' once unlocked). */
  theme: 'toy' | 'workshop';
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
  };
}

export function saveProgress(p: Progress): void {
  save(KEY, p);
}
