/**
 * Share codes: a finished cloth as a compact URL fragment, `#w=<base64url>`.
 * Byte layout (v1): [1, L, tie[0..L-1], R, row[0..R-1], rootMidi].
 * Decoding validates everything; an invalid code is ignored, never trusted.
 * No network: the code lives entirely in the link.
 */
import type { Level } from '../puzzle/levels.js';
import { computePar, rowReachable } from '../puzzle/par.js';
import type { Mask8 } from '../puzzle/tieup.js';

export interface SharedCloth {
  tieUp: Mask8[];
  rows: Mask8[];
  rootMidi: number;
  color?: number;
  weft?: number;
}

const VERSION = 2;
const SEA = 0x6cc0f0;

export function encodeCloth(c: SharedCloth): string {
  let water = 0;
  c.rows.forEach((r, i) => (water |= r & 256 ? 1 << i : 0));
  const col = c.color ?? 0;
  const bytes = [VERSION, c.tieUp.length, ...c.tieUp, c.rows.length, ...c.rows.map((r) => r & 0xff), water & 0xff, (water >> 8) & 0xff, (col >> 16) & 0xff, (col >> 8) & 0xff, col & 0xff, c.rootMidi & 0x7f];
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b & 0xff);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCloth(code: string): SharedCloth | null {
  try {
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(code)) return null;
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const b = Array.from(bin, (ch) => ch.charCodeAt(0));
    let i = 0;
    const v = b[i++];
    if (v !== 1 && v !== VERSION) return null;
    const L = b[i++];
    if (!(L >= 2 && L <= 4)) return null;
    const tieUp = b.slice(i, i + L);
    i += L;
    const R = b[i++];
    if (!(R >= 1 && R <= 12)) return null;
    const rows = b.slice(i, i + R);
    i += R;
    let color: number | undefined;
    let weft: number | undefined;
    if (v === 2) {
      const water = b[i] | (b[i + 1] << 8);
      i += 2;
      const col = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
      i += 3;
      if (col) color = col;
      for (let k = 0; k < R; k++) if ((water >> k) & 1) rows[k] |= 256;
      if (water) weft = SEA;
    }
    const rootMidi = b[i++];
    if (i !== b.length || tieUp.length !== L || rows.length !== R) return null;
    if (tieUp.some((m) => m === 0) || new Set(tieUp).size !== L) return null;
    if (rows.some((r) => !rowReachable(tieUp, r))) return null;
    if (!(rootMidi >= 48 && rootMidi <= 84)) return null;
    return { tieUp, rows, rootMidi, ...(color !== undefined ? { color } : {}), ...(weft !== undefined ? { weft } : {}) };
  } catch {
    return null;
  }
}

/** A shared cloth as a playable "weave this" level. */
export function clothLevel(c: SharedCloth): Level {
  return {
    id: 'shared',
    name: 'Shared cloth',
    tieUp: [...c.tieUp],
    target: [...c.rows],
    rootMidi: c.rootMidi,
    par: computePar(c.tieUp, c.rows),
    ...(c.color !== undefined ? { color: c.color } : {}),
    ...(c.weft !== undefined ? { weft: c.weft } : {}),
  };
}

/** Read `#w=` from a location hash. */
export function clothFromHash(hash: string): SharedCloth | null {
  const m = /[#&]w=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? decodeCloth(m[1]) : null;
}

export function shareUrl(c: SharedCloth, base = location.origin + location.pathname): string {
  return `${base}#w=${encodeCloth(c)}`;
}
