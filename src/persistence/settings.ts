/** Accessibility and comfort settings (2D page), persisted. */
import { load, save } from './storage.js';

export type HandPref = 'auto' | 'left' | 'right';

export interface Settings {
  highContrast: boolean;
  /** Which side the lever bank sits on; 'auto' = the hand you place with. */
  hand: HandPref;
}

const KEY = 'settings.v1';

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(KEY, {});
  return {
    highContrast: s.highContrast === true,
    hand: s.hand === 'left' || s.hand === 'right' ? s.hand : 'auto',
  };
}

export function saveSettings(s: Settings): void {
  save(KEY, s);
}
