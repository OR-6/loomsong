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
}

const VERSION = 1;

export function encodeCloth(c: SharedCloth): string {
  const bytes = [VERSION, c.tieUp.length, ...c.tieUp, c.rows.length, ...c.rows, c.rootMidi & 0x7f];
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
    if (b[i++] !== VERSION) return null;
    const L = b[i++];
    if (!(L >= 2 && L <= 4)) return null;
    const tieUp = b.slice(i, i + L);
    i += L;
    const R = b[i++];
    if (!(R >= 1 && R <= 12)) return null;
    const rows = b.slice(i, i + R);
    i += R;
    const rootMidi = b[i++];
    if (i !== b.length || tieUp.length !== L || rows.length !== R) return null;
    if (tieUp.some((m) => m === 0) || new Set(tieUp).size !== L) return null;
    if (rows.some((r) => !rowReachable(tieUp, r))) return null;
    if (!(rootMidi >= 48 && rootMidi <= 84)) return null;
    return { tieUp, rows, rootMidi };
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
