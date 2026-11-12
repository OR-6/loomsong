import { describe, expect, it } from 'vitest';
import { clothFromHash, clothLevel, decodeCloth, encodeCloth } from '../src/net/share';
import { levelAt } from '../src/puzzle/catalog';

describe('share codes', () => {
  it('round-trips every authored and many generated levels', () => {
    for (let i = 0; i < 40; i++) {
      const l = levelAt(i);
      const c = { tieUp: l.friend ? [...l.tieUp, l.friend] : l.tieUp, rows: l.target, rootMidi: l.rootMidi }; // as the win saves it
      const code = encodeCloth(c);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(code.length).toBeLessThanOrEqual(30);
      // share links carry the warps only (a two-colour cloth is shared single-colour)
      expect(decodeCloth(code)).toEqual({ ...c, rows: c.rows.map((r) => r & 255) });
    }
  });
  it('rejects malformed or unsafe codes', () => {
    const good = encodeCloth({ tieUp: [0x0f, 0xf0], rows: [0x0f, 0xff], rootMidi: 62 });
    expect(decodeCloth(good)).not.toBeNull();
    for (const bad of ['', 'x', '!!!!', good + 'AA', good.slice(0, -2), 'AQUBAgMEBQYHCAkKCwwNDg8Q']) {
      expect(decodeCloth(bad)).toBeNull();
    }
    // unreachable row
    expect(decodeCloth(encodeCloth({ tieUp: [0x0f, 0xf0], rows: [0x3c], rootMidi: 62 }))).toBeNull();
    // duplicate levers / zero lever / bad root
    expect(decodeCloth(encodeCloth({ tieUp: [0x0f, 0x0f], rows: [0x0f], rootMidi: 62 }))).toBeNull();
    expect(decodeCloth(encodeCloth({ tieUp: [0x00, 0x0f], rows: [0x0f], rootMidi: 62 }))).toBeNull();
    expect(decodeCloth(encodeCloth({ tieUp: [0x0f, 0xf0], rows: [0x0f], rootMidi: 20 }))).toBeNull();
  });
  it('reads #w= from a hash and builds a playable level with par', () => {
    const c = { tieUp: [0x0f, 0xf0, 0x18], rows: [0x0f, 0x1f, 0xff], rootMidi: 60 };
    const parsed = clothFromHash('#w=' + encodeCloth(c));
    expect(parsed).toEqual(c);
    const lv = clothLevel(parsed!);
    expect(lv.target).toEqual(c.rows);
    expect(Number.isFinite(lv.par)).toBe(true);
    expect(clothFromHash('#other')).toBeNull();
  });
});
