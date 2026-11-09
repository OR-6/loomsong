import { describe, expect, it } from 'vitest';
import { PINCH } from '../src/config';
import { PinchDetector } from '../src/input/pinch';

describe('PinchDetector hysteresis', () => {
  it('engages below 2.0 cm and releases only above 3.5 cm', () => {
    const p = new PinchDetector(PINCH);
    expect(p.update(0.025, 1 / 72)).toBe('none');
    expect(p.update(0.019, 1 / 72)).toBe('start');
    // inside the hysteresis band: stays pinched
    expect(p.update(0.03, 1 / 72)).toBe('none');
    expect(p.pinching).toBe(true);
    expect(p.update(0.036, 1 / 72)).toBe('end');
    expect(p.pinching).toBe(false);
  });

  it('scales thresholds with calibration', () => {
    const p = new PinchDetector(PINCH, 1.5);
    expect(p.update(0.028, 1 / 72)).toBe('start'); // < 2.0 * 1.5
    expect(p.update(0.05, 1 / 72)).toBe('none'); // < 3.5 * 1.5
    expect(p.update(0.054, 1 / 72)).toBe('end');
  });

  it('treats tracking loss > 150 ms as release, shorter gaps as hold', () => {
    const p = new PinchDetector(PINCH);
    p.update(0.01, 1 / 72);
    for (let i = 0; i < 10; i++) expect(p.update(null, 1 / 72)).toBe('none'); // ~139 ms
    p.update(0.01, 1 / 72);
    expect(p.pinching).toBe(true);
    let edge = 'none';
    for (let i = 0; i < 12 && edge === 'none'; i++) edge = p.update(null, 1 / 72);
    expect(edge).toBe('end');
  });
});
