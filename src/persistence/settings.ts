/** Accessibility and comfort settings (2D page), persisted. */
import { load, save } from './storage.js';
import type { CalResult } from '../input/calibration.js';

export type HandPref = 'auto' | 'left' | 'right';

export interface Settings {
  highContrast: boolean;
  /** Background music box (the threads always play). */
  music: boolean;
  /** Which side the lever bank sits on; 'auto' = the hand you place with. */
  hand: HandPref;
  /** Run "Fit to my hands" on the next XR entry. */
  calibrateNext: boolean;
  /** Set the table afresh on the next XR entry (instead of the loom coming back where it was). */
  placeFresh: boolean;
  /** Rows by ear (one row per picture hummed by Pip, hidden on the card); off: every row shows. */
  hearRows?: boolean;
  /** Look to play: look at a control for a moment to press it (no hands needed). */
  lookToPlay?: boolean;
  /** Rest to press: a fingertip held still in a control presses it; undefined: on when "Fit to my hands" found limited pinch or a tremor. */
  restPress?: boolean;
  /** Calm motion; undefined: follow the system's reduced-motion preference. */
  calmMotion?: boolean;
  calibration?: CalResult;
}

const KEY = 'settings.v1';

export function loadSettings(): Settings {
  const raw = load<unknown>(KEY, {});
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    highContrast: s.highContrast === true,
    music: s.music !== false,
    hand: s.hand === 'left' || s.hand === 'right' ? s.hand : 'auto',
    calibrateNext: s.calibrateNext === true,
    placeFresh: s.placeFresh === true,
    calmMotion: typeof s.calmMotion === 'boolean' ? s.calmMotion : undefined,
    lookToPlay: s.lookToPlay === true,
    restPress: typeof s.restPress === 'boolean' ? s.restPress : undefined,
    hearRows: s.hearRows !== false,
    calibration: validCal(s.calibration) ? s.calibration : undefined,
  };
}

/** Rest to press, as it applies: the switch, or (unset) only for hands that need it. */
export function restPressOn(s: Settings): boolean {
  if (typeof s.restPress === 'boolean') return s.restPress;
  const c = s.calibration;
  return !!c && (c.radiusMul > 1.15 || c.pinchScale > 1.25);
}

export function saveSettings(s: Settings): void {
  save(KEY, s);
}

function validCal(c: unknown): c is CalResult {
  const x = c as CalResult;
  const ok = (v: number, a: number, b: number) => typeof v === 'number' && v >= a && v <= b;
  return !!x && ok(x.pinchScale, 0.75, 1.8) && ok(x.radiusMul, 1, 1.8) && ok(x.minCutoff, 0.35, 1.5);
}
