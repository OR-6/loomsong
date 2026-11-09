import { describe, expect, it } from 'vitest';
import { isLifted, shedMask } from '../src/puzzle/tieup';

describe('tie-up OR', () => {
  const tie = [0b00010001, 0b00100010, 0b01000100, 0b10001000];
  it('ORs latched lever masks', () => {
    expect(shedMask(tie, [false, false, false, false])).toBe(0);
    expect(shedMask(tie, [true, false, true, false])).toBe(0b01010101);
    expect(shedMask(tie, [true, true, true, true])).toBe(0xff);
  });
  it('isLifted reads bits', () => {
    expect(isLifted(0b100, 2)).toBe(true);
    expect(isLifted(0b100, 1)).toBe(false);
  });
});
