/** Player progress, persisted with the guarded storage wrapper. */
import { load, save } from './storage.js';

export interface Progress {
  level: number;
  best: Record<string, number>;
  tutorialDone: boolean;
}

const KEY = 'progress.v1';

export function loadProgress(): Progress {
  const p = load<Partial<Progress>>(KEY, {});
  return {
    level: Number.isInteger(p.level) && (p.level as number) >= 0 ? (p.level as number) : 0,
    best: p.best && typeof p.best === 'object' ? p.best : {},
    tutorialDone: p.tutorialDone === true,
  };
}

export function saveProgress(p: Progress): void {
  save(KEY, p);
}
