/** Playable level list: authored levels with computed par. */
import { AUTHORED, type Level } from './levels.js';
import { computePar } from './par.js';

export const LEVELS: Level[] = AUTHORED.map((l) => ({ ...l, par: computePar(l.tieUp, l.target) }));
