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
  { id: 'garden', name: 'Garden', idea: 'one lever per row', pics: [
    { id: 'sprout', name: 'Sprout', color: 0x4f9a3a, rows: ['..#..#..', '...##...', '...##...', '...##...'] },
    { id: 'tulip', name: 'Tulip', color: 0xe2563b, rows: ['.#.##.#.', '.######.', '..####..', '...##...', '...##...'] },
    { id: 'tree', name: 'Tree', color: 0x2f8f5b, rows: ['...##...', '..####..', '.######.', '########', '...##...', '...##...'] },
    { id: 'duck', name: 'Duck', color: 0xf2b632, rows: ['.##.....', '####....', '.##.....', '.######.', '########', '.######.'] },
  ] },
  { id: 'home', name: 'Home', idea: 'two levers at once', pics: [
    { id: 'heart', name: 'Heart', color: 0xe2563b, rows: ['.##..##.', '########', '########', '.######.', '..####..', '...##...'] },
    { id: 'house', name: 'House', color: 0x3d5a80, rows: ['...##...', '..####..', '.######.', '########', '##.##.##', '##.##.##'] },
    { id: 'cup', name: 'Cup', color: 0x8a5a3b, rows: ['##.##.##', '########', '#######.', '#######.', '.#####..', '..###...'] },
    { id: 'star', name: 'Star', color: 0xf2b632, rows: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.'] },
    { id: 'mushroom', name: 'Mushroom', color: 0xc8453a, rows: ['..####..', '.######.', '##.##.##', '########', '...##...', '...##...'] },
  ] },
  { id: 'night', name: 'Night', idea: 'mystery levers', mystery: true, pics: [
    { id: 'ghost', name: 'Ghost', color: 0x6b6fb3, rows: ['..####..', '.######.', '##.##.##', '########', '########', '#.#..#.#'] },
    { id: 'cat', name: 'Cat', color: 0x2b2118, rows: ['#......#', '##....##', '########', '#.#..#.#', '########', '.######.'] },
    { id: 'key', name: 'Key', color: 0xc9a14a, rows: ['.###....', '#...####', '#...#.#.', '.###....'] },
    { id: 'sun', name: 'Sun', color: 0xf2a024, rows: ['#..##..#', '..####..', '.######.', '.######.', '..####..', '#..##..#'] },
  ] },
  { id: 'sea', name: 'Sea', idea: 'mostly combinations', mystery: true, pics: [
    { id: 'fish', name: 'Fish', color: 0x2a9d8f, rows: ['..###...', '.#####.#', '###.####', '.#####.#', '..###...'] },
    { id: 'butterfly', name: 'Butterfly', color: 0xd4537e, rows: ['##....##', '###..###', '.######.', '..####..', '.######.', '##....##'] },
    { id: 'crab', name: 'Crab', color: 0xd85a30, rows: ['#......#', '#.#..#.#', '.######.', '########', '.######.', '#.#..#.#'] },
    { id: 'rocket', name: 'Rocket', color: 0x534ab7, rows: ['...##...', '..####..', '..#..#..', '..####..', '.######.', '##.##.##'] },
    { id: 'flower', name: 'Flower', color: 0xd4537e, rows: ['..#..#..', '.######.', '..####..', '...##...', '.#.##.#.', '..#..#..'] },
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
    const tie = bestTieUp(target);
    if (!tie) { console.error('NOT WEAVABLE:', p.id); process.exitCode = 1; continue; }
    // Order levers so the first row's lever comes first (tutorial clarity).
    tie.sort((a, b) => (target[0] === b) - (target[0] === a) || pc(b) - pc(a));
    const pr = par(tie, target);
    const combos = target.filter((r) => !tie.includes(r)).length;
    console.log(`${ch.id.padEnd(7)} ${p.id.padEnd(10)} levers ${tie.length} rows ${target.length} combos ${combos} par ${pr}`);
    out.push({ id: p.id, name: p.name, chapter: ch.id, mystery: !!ch.mystery, color: p.color, picture: p.rows, tieUp: tie, target, par: pr, rootMidi: ROOTS[i++ % ROOTS.length] });
  }
}
const chapters = CHAPTERS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, levels: c.pics.map((p) => p.id) }));
const ts = `// GENERATED by tools/derive-tieups.mjs — do not edit by hand.
// Each picture's tie-up is the smallest lever set (≤ 4) that weaves every row,
// preferring levers that are whole picture rows. tests/pictures.test.ts re-verifies.
import type { PictureLevel, Chapter } from './pictures.js';

export const CHAPTERS: Chapter[] = ${JSON.stringify(chapters, null, 2)};

export const PICTURES: PictureLevel[] = ${JSON.stringify(out, null, 2).replace(/"color": (\d+)/g, (_, n) => `"color": 0x${(+n).toString(16).padStart(6, '0')}`)};
`;
writeFileSync(new URL('../src/puzzle/pictures.gen.ts', import.meta.url), ts);
console.log(`wrote ${out.length} levels`);
