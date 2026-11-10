#!/usr/bin/env node
/**
 * Offline level builder: for each 8-wide picture, find the smallest set of
 * lever masks (≤ 4) whose ORs produce every row, preferring masks that are
 * whole picture rows (easiest to read). Writes src/puzzle/pictures.gen.ts.
 * Run: node tools/derive-tieups.mjs
 */
import { writeFileSync } from 'node:fs';

// Chapters: each introduces one idea. Rows are drawn top→bottom.
const CHAPTERS = [
  { id: 'garden', name: 'Garden', idea: 'one lever per row', rule: 'rows', pics: [
    { id: 'sprout', name: 'Sprout', color: 0x4f9a3a, rows: ['..#..#..', '...##...', '...##...', '...##...'] },
    { id: 'tulip', name: 'Tulip', color: 0xe2563b, rows: ['.#.##.#.', '.######.', '..####..', '...##...', '...##...'] },
    { id: 'tree', name: 'Tree', color: 0x2f8f5b, rows: ['...##...', '..####..', '.######.', '########', '...##...', '...##...'] },
    { id: 'duck', name: 'Duck', color: 0xf2b632, rows: ['.##.....', '####....', '.##.....', '.######.', '########', '.######.'] },
  ] },
  { id: 'home', name: 'Home', idea: 'two levers at once', rule: 'parts', pics: [
    { id: 'cup', name: 'Cup', color: 0x8a5a3b, rows: ['##.##.##', '########', '#######.', '#######.', '.#####..', '..###...'] },
    { id: 'heart', name: 'Heart', color: 0xe2563b, rows: ['.##..##.', '########', '########', '.######.', '..####..', '...##...'] },
    { id: 'house', name: 'House', color: 0x3d5a80, rows: ['...##...', '..####..', '.######.', '########', '##.##.##', '##.##.##'] },
    { id: 'mushroom', name: 'Mushroom', color: 0xc8453a, rows: ['..####..', '.######.', '##.##.##', '########', '...##...', '...##...'] },
    { id: 'star', name: 'Star', color: 0xf2b632, rows: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.'] },
  ] },
  { id: 'night', name: 'Night', idea: 'mystery levers', rule: 'parts', mystery: true, pics: [
    { id: 'key', name: 'Key', color: 0xc9a14a, rows: ['.###....', '#...####', '#...#.#.', '.###....'] },
    { id: 'ghost', name: 'Ghost', color: 0x6b6fb3, rows: ['..####..', '.######.', '##.##.##', '########', '########', '#.#..#.#'] },
    { id: 'sun', name: 'Sun', color: 0xf2a024, rows: ['#..##..#', '..####..', '.######.', '.######.', '..####..', '#..##..#'] },
    { id: 'cat', name: 'Cat', color: 0x2b2118, rows: ['#......#', '##....##', '########', '#.#..#.#', '########', '.######.'] },
  ] },
  { id: 'sea', name: 'Sea', idea: 'mostly combinations', rule: 'parts', mystery: true, pics: [
    { id: 'fish', name: 'Fish', color: 0x2a9d8f, rows: ['..###...', '.#####.#', '###.####', '.#####.#', '..###...'] },
    { id: 'crab', name: 'Crab', color: 0xd85a30, rows: ['#......#', '#.#..#.#', '.######.', '########', '.######.', '#.#..#.#'] },
    { id: 'flower', name: 'Flower', color: 0xd4537e, rows: ['..#..#..', '.######.', '..####..', '...##...', '.#.##.#.', '..#..#..'] },
    { id: 'butterfly', name: 'Butterfly', color: 0xd4537e, rows: ['##....##', '###..###', '.######.', '..####..', '.######.', '##....##'] },
    { id: 'rocket', name: 'Rocket', color: 0x534ab7, rows: ['...##...', '..####..', '..#..#..', '..####..', '.######.', '##.##.##'] },
  ] },
];

const bits = (s) => [...s].reduce((m, c, i) => (c === '#' ? m | (1 << i) : m), 0);
const canMake = (rows, masks) => rows.every((r) => { let u = 0; for (const m of masks) if ((m & ~r) === 0) u |= m; return u === r; });
const pc = (n) => { let c = 0; while (n) { n &= n - 1; c++; } return c; };

function bestTieUp(rows) {
  const D = [...new Set(rows)];
  // Candidates: picture rows first (readable), then other sub-masks of rows.
  const other = [];
  for (let m = 1; m < 256; m++) if (!D.includes(m) && D.some((r) => (m & ~r) === 0)) other.push(m);
  const cand = [...D.sort((a, b) => pc(a) - pc(b)), ...other];
  for (let L = 1; L <= 4; L++) {
    let best = null, bestScore = -1;
    const pick = [];
    let tries = 0;
    const rec = (s) => {
      if (tries > 3e6) return;
      if (pick.length === L) {
        tries++;
        if (canMake(D, pick)) {
          const score = pick.filter((m) => D.includes(m)).length; // prefer row-masks
          if (score > bestScore) { bestScore = score; best = [...pick]; }
        }
        return;
      }
      for (let i = s; i < cand.length; i++) { pick.push(cand[i]); rec(i + 1); pick.pop(); if (bestScore === L) return; }
    };
    rec(0);
    if (best) return best;
  }
  return null;
}

/** Number of separate runs of set bits (1 = one solid block; readable). */
const runs = (m) => { let r = 0, prev = 0; for (let i = 0; i < 8; i++) { const b = (m >> i) & 1; if (b && !prev) r++; prev = b; } return r; };
const mirror = (m) => { let o = 0; for (let i = 0; i < 8; i++) if ((m >> i) & 1) o |= 1 << (7 - i); return o; };
/** Rows that need two or more levers together. */
const combosOf = (rows, tie) => [...new Set(rows)].filter((r) => !tie.includes(r)).length;

/**
 * "Parts" tie-up: levers are readable pieces (a solid run, or a run and its
 * mirror image), chosen so as many rows as possible need levers combined.
 * Uses the fewest levers that work, or one more (≤ 4) if that adds combos.
 */
function partsTieUp(rows) {
  const D = [...new Set(rows)];
  const cand = new Set();
  for (let a = 0; a < 8; a++) for (let b = a; b < 8; b++) {
    const run = ((1 << (b - a + 1)) - 1) << a;
    for (const m of [run, run | mirror(run)]) if (D.some((r) => (m & ~r) === 0)) cand.add(m);
  }
  const C = [...cand];
  let found = null;
  for (let L = 1; L <= 4; L++) {
    let best = null, bestScore = -Infinity;
    const pick = [];
    const rec = (s) => {
      if (pick.length === L) {
        if (!canMake(D, pick)) return;
        const score = combosOf(D, pick) * 10 - pick.reduce((n, m) => n + runs(m), 0);
        if (score > bestScore) { bestScore = score; best = [...pick]; }
        return;
      }
      for (let i = s; i < C.length; i++) { pick.push(C[i]); rec(i + 1); pick.pop(); }
    };
    rec(0);
    if (best) {
      if (!found) { found = best; if (combosOf(D, best) >= Math.ceil(D.length / 2) || L === 4) break; continue; }
      if (combosOf(D, best) > combosOf(D, found)) found = best;
      break;
    }
  }
  return found;
}

function par(tie, target) {
  const S = 1 << tie.length;
  const sh = (s) => tie.reduce((m, t, k) => ((s >> k) & 1 ? m | t : m), 0);
  let cost = Array(S).fill(Infinity); cost[0] = 0;
  for (const row of target) {
    const next = Array(S).fill(Infinity);
    for (let s = 0; s < S; s++) if (sh(s) === row) for (let p = 0; p < S; p++) next[s] = Math.min(next[s], cost[p] + pc(p ^ s));
    cost = next;
  }
  return Math.min(...cost);
}

const ROOTS = [62, 60, 65, 67, 64, 69];
const out = [];
let i = 0;
for (const ch of CHAPTERS) {
  for (const p of ch.pics) {
    const target = p.rows.map(bits).reverse(); // weave bottom row first
    const tie = ch.rule === 'parts' ? partsTieUp(target) ?? bestTieUp(target) : bestTieUp(target);
    if (!tie) { console.error('NOT WEAVABLE:', p.id); process.exitCode = 1; continue; }
    // Order levers so the first row's lever comes first (tutorial clarity).
    // Garden: the first row's lever first (tutorial). Parts: biggest piece first.
    tie.sort((a, b) => (target[0] === b) - (target[0] === a) || pc(b) - pc(a));
    const pr = par(tie, target);
    const combos = target.filter((r) => !tie.includes(r)).length;
    console.log(`${ch.id.padEnd(7)} ${p.id.padEnd(10)} levers ${tie.length} rows ${target.length} combos ${combos} par ${pr}`);
    out.push({ id: p.id, name: p.name, chapter: ch.id, mystery: !!ch.mystery, color: p.color, picture: p.rows, tieUp: tie, target, par: pr, rootMidi: ROOTS[i++ % ROOTS.length] });
  }
}
const chapters = CHAPTERS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, levels: c.pics.map((p) => p.id) }));
const ts = `// GENERATED by tools/derive-tieups.mjs — do not edit by hand.
// Garden: the smallest lever set (≤ 4) that weaves every row, preferring whole
// picture rows. Home/Night/Sea: levers are readable parts (runs, mirrored runs)
// chosen so most rows need levers combined. tests/pictures.test.ts re-verifies.
import type { PictureLevel, Chapter } from './pictures.js';

export const CHAPTERS: Chapter[] = ${JSON.stringify(chapters, null, 2)};

export const PICTURES: PictureLevel[] = ${JSON.stringify(out, null, 2).replace(/"color": (\d+)/g, (_, n) => `"color": 0x${(+n).toString(16).padStart(6, '0')}`)};
`;
writeFileSync(new URL('../src/puzzle/pictures.gen.ts', import.meta.url), ts);
console.log(`wrote ${out.length} levels`);
