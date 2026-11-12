import { describe, expect, it } from 'vitest';
import { CHAPTERS, DAILY, PICTURES } from '../src/puzzle/pictures.gen';
import { DAILY_LEVELS, LEVELS, dailyLevel, dayKey, dayKind, levelAt, mendLevel, pictureById, streakOf } from '../src/puzzle/catalog';
import { computePar, rowReachable } from '../src/puzzle/par';
import { WARPS } from '../src/config';

const bits = (s: string) => [...s].reduce((m, c, i) => (c === '#' ? m | (1 << i) : m), 0) | (s.includes('~') ? 256 : 0);

describe('picture levels', () => {
  it('every picture is weavable with its tie-up and its par is the true minimum', () => {
    for (const p of PICTURES) {
      expect(p.tieUp.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.tieUp.length, p.id).toBeLessThanOrEqual(4);
      expect(p.picture.every((r) => r.length === WARPS), p.id).toBe(true);
      expect(p.target, p.id).toEqual(p.picture.map(bits).reverse());
      // a friend picture: rows holding the friend's threads are the friend plus levers (seating it is no lever move)
      const f = p.friend ?? 0;
      const leverRows = f ? p.target.map((r) => ((r & f) === f ? r & ~f : r)) : p.target;
      for (const row of leverRows) expect(row === 0 || rowReachable(p.tieUp, row), `${p.id} row`).toBe(true);
      expect(p.par, p.id).toBe(computePar(p.tieUp, leverRows, p.mystery));
      expect(p.name.split(' ').length).toBeLessThanOrEqual(3);
    }
  });
  it('chapters cover every picture once, in order', () => {
    const ids = CHAPTERS.flatMap((c) => c.levels);
    expect(ids).toEqual(PICTURES.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('difficulty rises: Garden has the fewest combinations; level 1 has exactly one (the aha)', () => {
    const combos = (id: string) => {
      const p = PICTURES.find((x) => x.id === id)!;
      return p.target.filter((r) => !p.tieUp.includes(r & 255)).length;
    };
    const avg = (ch: string) => {
      const ls = CHAPTERS.find((c) => c.id === ch)!.levels;
      return ls.reduce((a, id) => a + combos(id), 0) / ls.length;
    };
    expect(avg('garden')).toBeLessThan(avg('home'));
    expect(combos('sprout')).toBe(1); // the aha: the top row needs both levers
  });
  it('level sequence: the pictures, then the pictures again (for gold)', () => {
    expect(levelAt(0).id).toBe('sprout');
    expect(levelAt(LEVELS.length - 1).id).toBe(PICTURES.at(-1)!.id);
    expect(levelAt(LEVELS.length).id).toBe('sprout');
  });
  it('the picture of the day is stable for a day and the whole set comes round before a repeat', () => {
    expect(dailyLevel('2026-11-10')).toEqual(dailyLevel('2026-11-10'));
    const n = DAILY_LEVELS.length;
    const run = Array.from({ length: n }, (_, k) => dailyLevel(new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10)).id);
    expect(new Set(run).size).toBe(n);
    expect(dayKey(new Date(2026, 10, 9))).toBe('2026-11-09');
    expect(dailyLevel('2026-11-30').chapter).toBe('daily');
  });
  it('pictures of the day are weavable, true par, readable, and new pictures', () => {
    expect(DAILY.length).toBeGreaterThanOrEqual(20);
    for (const p of DAILY) {
      expect(p.tieUp.length, p.id).toBeLessThanOrEqual(4);
      expect(p.picture.every((r) => r.length === WARPS), p.id).toBe(true);
      expect(p.target, p.id).toEqual(p.picture.map(bits).reverse());
      expect(p.target.every((r) => r > 0), `${p.id} has an empty row`).toBe(true);
      for (const row of p.target) expect(rowReachable(p.tieUp, row), `${p.id} row`).toBe(true);
      expect(p.par, p.id).toBe(computePar(p.tieUp, p.target, !!p.mystery));
      expect(PICTURES.some((q) => q.picture.join() === p.picture.join()), p.id).toBe(false);
      expect(pictureById(p.id)?.name).toBe(p.name);
    }
  });
  it('the streak counts days in a row, ending today or yesterday', () => {
    expect(streakOf([], '2026-11-11')).toBe(0);
    expect(streakOf(['2026-11-11'], '2026-11-11')).toBe(1);
    expect(streakOf(['2026-11-09', '2026-11-10', '2026-11-11'], '2026-11-11')).toBe(3);
    expect(streakOf(['2026-11-09', '2026-11-10'], '2026-11-11')).toBe(2); // today's still to do
    expect(streakOf(['2026-11-08', '2026-11-10', '2026-11-11'], '2026-11-11')).toBe(2);
    expect(streakOf(['2026-10-31', '2026-11-01'], '2026-11-01')).toBe(2); // across a month
  });
  it("Sea's two-colour pictures: '~' rows carry the weft bit, a row never mixes cream and water", () => {
    const sea = PICTURES.filter((p) => p.weft);
    expect(sea.length).toBeGreaterThanOrEqual(2);
    for (const p of sea) {
      for (const row of p.picture) expect(row.includes('~') && row.includes('.'), `${p.id} ${row}`).toBe(false);
      expect(p.target.some((r) => r & 256), p.id).toBe(true);
    }
    // a picture that mixes both yarns makes the swap a real step
    expect(sea.some((p) => p.target.some((r) => r & 256) && p.target.some((r) => !(r & 256)))).toBe(true);
  });
  it('no two levels share a lever set', () => {
    const sets = PICTURES.map((p) => [...p.tieUp].sort((a, b) => a - b).join(','));
    expect(new Set(sets).size).toBe(sets.length);
  });
  it('tangled cloths: woven part-way with exactly one wrong row (not the top), weavable, par is the reweave', () => {
    const mended = LEVELS.filter((l) => l.mend);
    expect(mended.map((l) => l.id).sort()).toEqual(['octopus', 'owl']);
    for (const l of [...mended, ...DAILY_LEVELS.map((d) => mendLevel(d, 4, 1))]) {
      const m = l.mend!;
      const wrong = m.map((r, i) => (r !== l.target[i] ? i : -1)).filter((i) => i >= 0);
      expect(wrong.length, l.id).toBe(1);
      expect(wrong[0], l.id).toBeLessThan(m.length - 1);
      expect(m[wrong[0]] & 256, l.id).toBe(l.target[wrong[0]] & 256); // only the threads are wrong, not the yarn
      expect(rowReachable(l.tieUp, m[wrong[0]]), l.id).toBe(true);
      expect(l.par, l.id).toBe(computePar(l.tieUp, l.target.slice(wrong[0]), !!l.mystery, l.hideFrom ?? 0));
    }
  });
  it('Night eases in: the Moon hides two levers, the Ghost three, the rest all; par counts only hidden first tries free', () => {
    const at = (id: string) => LEVELS.find((l) => l.id === id)!;
    expect(at('moon').hideFrom).toBe(2);
    expect(at('ghost').hideFrom).toBe(1);
    expect(at('cat').hideFrom ?? 0).toBe(0);
    for (const id of ['moon', 'ghost']) {
      const l = at(id);
      expect(l.par).toBe(computePar(l.tieUp, l.target, true, l.hideFrom));
      expect(l.par).toBeGreaterThanOrEqual(computePar(l.tieUp, l.target, true, 0));
    }
  });
  it('replays come twisted (tangled, the tide, hidden levers); friend pictures keep their friend', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < LEVELS.length * 3; k++) {
      const l = levelAt(LEVELS.length + k);
      const base = LEVELS[k % LEVELS.length];
      expect(l.id).toBe(base.id);
      if (base.friend) expect(l).toBe(base);
      else if (!base.mend) {
        const kind = l.mend ? 'tangled' : l.tide ? 'tide' : l.mystery && !base.mystery ? 'hidden' : l.mystery ? 'hidden-already' : 'plain';
        kinds.add(kind);
        if (l.mystery && !base.mystery) expect(l.par).toBe(computePar(l.tieUp, l.target, true, 0));
      }
    }
    expect([...kinds].filter((k) => k !== 'hidden-already').sort()).toEqual(['hidden', 'tangled', 'tide']);
    expect(levelAt(LEVELS.length + 3)).toBe(levelAt(LEVELS.length + 3)); // cached: no garbage per call
  });
  it('the picture of the day turns through four kinds', () => {
    const run = Array.from({ length: 8 }, (_, k) => dayKind(new Date(Date.UTC(2026, 10, 1 + k)).toISOString().slice(0, 10)));
    expect(new Set(run)).toEqual(new Set(['plain', 'tangled', 'hidden', 'tide']));
    expect(run.slice(0, 4)).toEqual(run.slice(4, 8));
  });
});
