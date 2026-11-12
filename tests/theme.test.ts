import { describe, expect, it } from 'vitest';
import { workshopUnlocked } from '../src/persistence/progress';
import { THEMES, otherTheme } from '../src/ui/theme';
import { LoomController } from '../src/loom/loom-controller';
import { LoomModel } from '../src/loom/loom-model';
import { NUDGE, TOKEN, nudgeX, tokenX } from '../src/config';

function lum(hex: number) {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

describe('themes', () => {
  it('workshop unlocks once Home is done (never during Garden)', () => {
    expect(workshopUnlocked({ best: {} })).toBe(false);
    expect(workshopUnlocked({ best: { sprout: 3, tulip: 1, duck: 1, table: 2 } })).toBe(false);
    expect(workshopUnlocked({ best: { sprout: 3, tulip: 1, duck: 1, table: 2, heart: 1, house: 1 } })).toBe(false);
    expect(workshopUnlocked({ best: { sprout: 3, tulip: 1, duck: 1, table: 2, heart: 1, house: 1, star: 1, cup: 1 } })).toBe(true);
  });
  it('every theme keeps yarn luminance contrast ≥ 3:1 (pattern legible without hue)', () => {
    for (const t of Object.values(THEMES)) {
      const a = lum(t.palette.warp);
      const b = lum(t.palette.weft);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(ratio, t.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('otherTheme toggles', () => {
    expect(otherTheme('toy')).toBe('workshop');
    expect(otherTheme('workshop')).toBe('toy');
  });
  it('nudge arrows press only when enabled, with direction', () => {
    const dirs: number[] = [];
    const c = new LoomController(new LoomModel([1, 2]), { nudge: (d) => dirs.push(d) });
    const idle = { tracked: false, pinching: false, edge: 'none' as const, pinch: { x: 0, y: 1, z: 0 }, index: { x: 0, y: 1, z: 0 }, indexVel: { x: 0, y: 0, z: 0 } };
    const at = (z: number) => ({ x: nudgeX(1), y: NUDGE.y, z });
    const poke = (p: { x: number; y: number; z: number }) => [
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.05 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.003 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.08 }, indexVel: { x: 0, y: 0.3, z: 0 } },
    ];
    for (const f of poke(at(NUDGE.upZ))) c.update({ right: f, left: idle }, 1 / 72);
    expect(dirs).toEqual([]);
    c.nudgeEnabled = true;
    for (const f of poke(at(NUDGE.upZ))) c.update({ right: f, left: idle }, 1 / 72);
    for (const f of poke(at(NUDGE.downZ))) c.update({ right: f, left: idle }, 1 / 72);
    expect(dirs).toEqual([1, -1]);
  });

  it('token presses only when enabled (poke)', () => {
    let presses = 0;
    const c = new LoomController(new LoomModel([1, 2]), { token: () => presses++ });
    const p = { x: tokenX(1), y: TOKEN.y, z: TOKEN.z };
    const idle = { tracked: false, pinching: false, edge: 'none' as const, pinch: { x: 0, y: 1, z: 0 }, index: { x: 0, y: 1, z: 0 }, indexVel: { x: 0, y: 0, z: 0 } };
    const pokeFrames = [
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.05 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.003 }, indexVel: { x: 0, y: -0.3, z: 0 } },
      { ...idle, tracked: true, index: { ...p, y: p.y + 0.08 }, indexVel: { x: 0, y: 0.3, z: 0 } },
    ];
    for (const f of pokeFrames) c.update({ right: f, left: idle }, 1 / 72);
    expect(presses).toBe(0);
    c.tokenEnabled = true;
    for (const f of pokeFrames) c.update({ right: f, left: idle }, 1 / 72);
    expect(presses).toBe(1);
  });
});

import { highContrast } from '../src/ui/theme';

describe('high contrast', () => {
  it('returns a stable object per theme with pure white/near-black yarn', () => {
    const a = highContrast(THEMES.toy);
    expect(highContrast(THEMES.toy)).toBe(a);
    expect(a.palette.warp).toBe(0xffffff);
    expect(a.palette.weft).toBe(0x111111);
    expect(highContrast(THEMES.workshop).palette.wood).toBe(THEMES.workshop.palette.wood);
  });
});
