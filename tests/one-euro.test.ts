import { describe, expect, it } from 'vitest';
import { OneEuro } from '../src/input/one-euro';

describe('One-Euro filter', () => {
  it('reduces stationary jitter and follows steady motion', () => {
    const f = new OneEuro({ minCutoff: 1, beta: 0.02, dCutoff: 1 });
    let maxDev = 0;
    for (let i = 0; i < 300; i++) {
      const y = f.filter(Math.sin(i * 12.9898) * 0.003, 1 / 72);
      if (i > 20) maxDev = Math.max(maxDev, Math.abs(y));
    }
    expect(maxDev).toBeLessThan(0.0015);
    const g = new OneEuro({ minCutoff: 1, beta: 0.02, dCutoff: 1 });
    let y = 0;
    for (let i = 0; i < 144; i++) y = g.filter(i * 0.002, 1 / 72);
    expect(Math.abs(y - 143 * 0.002)).toBeLessThan(0.05);
  });
});
