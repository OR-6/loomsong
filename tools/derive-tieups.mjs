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
  { id: 'garden', name: 'Garden', idea: 'levers add up', rule: 'rows', pics: [
    // the aha in level 1: the top row is the stem AND the leaves, so the leaf lever joins the stem lever
    { id: 'sprout', name: 'Sprout', color: 0x4f9a3a, rows: ['.#.##.#.', '...##...', '...##...'], tie: [0b00011000, 0b01000010] },
    { id: 'tulip', name: 'Tulip', color: 0xe2563b, rows: ['.#.##.#.', '.######.', '..####..', '...##...', '...##...'] },
    { id: 'duck', name: 'Duck', color: 0xe9a21a, rule: 'parts', rows: ['.##.....', '####....', '.##.....', '.######.', '########', '.######.'] },
    // a friend picture: a plush on the cushion lifts the threads under its feet (its bottom row);
    // the legs need it off, the tabletop, vase and flower need it on (the Sprout and the Tulip on the Garden shelf fit)
    { id: 'table', name: 'Flower table', color: 0xb5683a, rows: ['...##...', '..####..', '########', '..#..#..', '..#..#..'], tie: [0b00100100, 0b00000011, 0b11000000], friend: 0b00011000 },
  ] },
  { id: 'home', name: 'Home', idea: 'two levers at once', rule: 'parts', pics: [
    { id: 'heart', name: 'Heart', color: 0xe2563b, rows: ['.##..##.', '########', '########', '.######.', '..####..', '...##...'] },
    { id: 'house', name: 'House', color: 0xf08a4b, rows: ['...##...', '..####..', '.######.', '########', '##.##.##', '##.##.##'] },
    { id: 'star', name: 'Star', color: 0xf2b632, rows: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.'] },
    // a mug side-on: two wisps of steam, the rim, the handle's loop on the right, a foot
    { id: 'cup', name: 'Cup', color: 0x3d8fd1, rows: ['.#..#...', '######..', '#####.#.', '#####.#.', '######..', '.####...'] },
  ] },
  { id: 'night', name: 'Night', idea: 'mystery levers', rule: 'parts', mystery: true, pics: [
    { id: 'moon', name: 'Moon', color: 0xeeae1c, rows: ['..###...', '.##.....', '##......', '##......', '.##.....', '..###...'] },
    { id: 'ghost', name: 'Ghost', color: 0xc9cdf7, rows: ['..####..', '.######.', '.#.##.#.', '.######.', '.#######', '.....###'] },
    { id: 'owl', name: 'Owl', color: 0xe08a3c, rows: ['.#....#.', '.######.', '#.#..#.#', '###..###', '.######.', '..####..'] },
    { id: 'cat', name: 'Cat', color: 0x8f63c9, rows: ['#......#', '##....##', '########', '#.#..#.#', '########', '.######.'] },
    // the second friend picture: only a Night plush is in reach here; the Owl's feet (the middle four) light the
    // lantern's top and its wide stand (the Cat's wide feet do too); the hook, frame and flame need the friend off again
    { id: 'lantern', name: 'Lantern', color: 0xf2b632, rows: ['...##...', '.######.', '.#....#.', '.#.##.#.', '.#....#.', '########'], tie: [0b01000010, 0b00011000, 0b10000001], friend: 0b00111100 },
  ] },
  { id: 'sea', name: 'Sea', idea: 'mostly combinations', rule: 'parts', mystery: true, pics: [
    { id: 'fish', name: 'Fish', color: 0xf08a4b, weft: 0x6cc0f0, rows: ['..###...', '~#####~#', '###~####', '~#####~#', '~~###~~~'] },
    { id: 'crab', name: 'Crab', color: 0xd85a30, rows: ['#......#', '#.#..#.#', '.######.', '########', '.######.', '#.#..#.#'] },
    { id: 'octopus', name: 'Octopus', color: 0xd4537e, weft: 0x6cc0f0, rows: ['~~####~~', '~######~', '~#~##~#~', '~######~', '#~#~#~#~', '#~#~#~#~'] },
    { id: 'boat', name: 'Boat', color: 0xe2563b, weft: 0x6cc0f0, rows: ['...#....', '...##...', '...###..', '...#....', '~######~', '~######~'] },
    // the Sea's friend picture: only the Crab's feet reach the outermost threads, so its rim and frills need the
    // Crab on the cushion (the Fish, Octopus and Boat feet don't fit); the dome and tentacles need it off
    { id: 'jellyfish', name: 'Jellyfish', color: 0xc77dd6, rows: ['..####..', '.######.', '########', '#.#..#.#', '.#.##.#.', '..#..#..'], tie: [0b00100100, 0b00011000, 0b01000010], friend: 0b10100101 },
  ] },
];


// The picture of the day: one a day, in order, for everyone (catalog.dailyLevel). Readable parts levers.
const DAILY = [
  { id: 'bell', name: 'Bell', color: 0xf2b632, rows: ['...##...', '..####..', '..####..', '.######.', '########', '...##...'] },
  { id: 'mushroom', name: 'Mushroom', color: 0xd85a30, rows: ['..####..', '.##.###.', '########', '...##...', '..####..'] },
  { id: 'pine', name: 'Pine', color: 0x2f8f5b, rows: ['...##...', '..####..', '...##...', '.######.', '########', '...##...'] },
  { id: 'pear', name: 'Pear', color: 0xa9b82e, rows: ['....##..', '...#....', '..####..', '..####..', '.######.', '.######.'] },
  { id: 'key', name: 'Key', color: 0xd9a441, rows: ['.##.....', '#..#####', '#..#.#.#', '.##.....'] },
  { id: 'rabbit', name: 'Rabbit', color: 0xb9a48a, rows: ['..#.#...', '..#.#...', '..###...', '.#####..', '.######.', '..##.##.'] },
  { id: 'sun', name: 'Sun', color: 0xf2a024, rows: ['#..##..#', '..####..', '.######.', '.######.', '..####..', '#..##..#'] },
  { id: 'crown', name: 'Crown', color: 0xe8b04a, rows: ['#..##..#', '##.##.##', '########', '########'] },
  { id: 'butterfly', name: 'Butterfly', color: 0xd4537e, rows: ['##....##', '###..###', '.######.', '.######.', '###..###', '##....##'] },
  { id: 'snowman', name: 'Snowman', color: 0x7fb3d9, rows: ['...##...', '..####..', '...##...', '.######.', '.######.', '..####..'] },
  { id: 'icecream', name: 'Ice cream', color: 0xe98aa8, rows: ['..####..', '.######.', '########', '.#.##.#.', '..####..', '...##...'] },
  { id: 'frog', name: 'Frog', color: 0x5aa83a, rows: ['.##..##.', '#.#..#.#', '########', '#......#', '.######.'] },
  { id: 'bear', name: 'Bear', color: 0x9a6a44, rows: ['##....##', '.######.', '#.#..#.#', '###..###', '.######.'] },
  { id: 'rocket', name: 'Rocket', color: 0x3d8fd1, rows: ['...##...', '..####..', '..####..', '..####..', '.######.', '.#.##.#.'] },
  { id: 'candle', name: 'Candle', color: 0xf08a4b, rows: ['...#....', '...##...', '..####..', '..####..', '..####..', '.######.'] },
  { id: 'gift', name: 'Gift', color: 0xe2563b, rows: ['..#..#..', '...##...', '########', '#..##..#', '#..##..#', '########'] },
  { id: 'anchor', name: 'Anchor', color: 0x3d5a80, rows: ['...##...', '..#..#..', '...##...', '#..##..#', '.#.##.#.', '..####..'] },
  { id: 'acorn', name: 'Acorn', color: 0xa86a32, rows: ['...##...', '.######.', '########', '.######.', '..####..', '...##...'] },
  { id: 'ladybug', name: 'Ladybug', color: 0xc7303a, rows: ['..#..#..', '.######.', '##.##.##', '########', '##.##.##', '.######.'] },
  { id: 'jelly', name: 'Squid', color: 0xc77dd6, rows: ['..####..', '.######.', '########', '#.#..#.#', '#.#..#.#', '.#.#.#..'] },
  { id: 'robot', name: 'Robot', color: 0x2a9d8f, rows: ['...##...', '.######.', '.#.##.#.', '.######.', '########', '.##..##.'] },
];

const bits = (s) => [...s].reduce((m, c, i) => (c === '#' ? m | (1 << i) : m), 0);
/** A row drawn with '~' ground is woven with the second weft (bit 8). */
const rowVal = (s) => bits(s) | (s.includes('~') ? 256 : 0);
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
/** Rows that can be made more than one way with these levers (a choice the knots can reward). */
const choicesOf = (rows, tie) => {
  let n = 0;
  for (const r of new Set(rows)) {
    let ways = 0;
    for (let s = 1; s < 1 << tie.length; s++) {
      let m = 0;
      for (let k = 0; k < tie.length; k++) if ((s >> k) & 1) m |= tie[k];
      if (m === r) ways++;
    }
    if (ways > 1) n++;
  }
  return n;
};
/** Lever sets already used by earlier levels (no two levels share one). */
const usedSets = new Set();
const sig = (tie) => [...tie].sort((a, b) => a - b).join(',');

/** Moves a row-by-row player makes (cheapest change for each row from the levers as they are, nothing planned). */
function greedy(tie, target) {
  const S = 1 << tie.length;
  const sh = (s) => tie.reduce((m, t, k) => ((s >> k) & 1 ? m | t : m), 0);
  let state = 0;
  let total = 0;
  for (const row of target) {
    let best = -1;
    for (let s = 0; s < S; s++) if (sh(s) === row && (best < 0 || pc(state ^ s) < pc(state ^ best))) best = s;
    if (best < 0) return Infinity;
    total += pc(state ^ best);
    state = best;
  }
  return total;
}
/** Picture rows (all of them, repeats counted) that one lever makes alone. */
let SOLO_ROWS = [];
const soloRows = (D, tie) => SOLO_ROWS.filter((r) => tie.includes(r)).length;
/** Pairs of levers that share threads (then a row can be made more than one way). */
function overlaps(tie) {
  let n = 0;
  for (let a = 0; a < tie.length; a++) for (let b = a + 1; b < tie.length; b++) if (tie[a] & tie[b]) n++;
  return n;
}
/** Planning: how many moves greedy loses against par (in the order the rows are woven). */
function planning(tie, rowsInOrder) {
  const g = greedy(tie, rowsInOrder);
  return Number.isFinite(g) ? g - par(tie, rowsInOrder, false) : 0; // like for like: neither counts free first tries
}

function partsTieUp(rows, ordered = rows) {
  const D = [...new Set(rows)];
  const cand = new Set();
  for (let a = 0; a < 8; a++) for (let b = a; b < 8; b++) {
    const run = ((1 << (b - a + 1)) - 1) << a;
    for (const m of [run, run | mirror(run)]) if (D.some((r) => (m & ~r) === 0)) cand.add(m);
  }
  if (EXTRA_CANDS) {
    // the picture's own rows, and the parts two rows share or don't: overlapping levers, rows made more than one way
    for (const r of D) if (r) cand.add(r);
    for (const a of D) for (const b of D) {
      if (a === b) continue;
      if (a & b) cand.add(a & b);
      if (a & ~b & 255) cand.add(a & ~b & 255);
    }
  }
  const C = [...cand];
  let found = null;
  for (let L = 1; L <= 4; L++) {
    let best = null, bestScore = -Infinity;
    const pick = [];
    const rec = (s) => {
      if (pick.length === L) {
        if (!canMake(D, pick)) return;
        const score = combosOf(D, pick) * 10 + choicesOf(D, pick) * 6 - pick.reduce((n, m) => n + runs(m), 0) - (usedSets.has(sig(pick)) ? 100 : 0) + PLAN_W * planning(pick, ordered) + OVERLAP_W * overlaps(pick) - SOLO_W * soloRows(D, pick);
        if (score > bestScore) { bestScore = score; best = [...pick]; }
        return;
      }
      for (let i = s; i < C.length; i++) { pick.push(C[i]); rec(i + 1); pick.pop(); }
    };
    rec(0);
    if (best) {
      // keep looking up to 4 levers; take the best-scoring set overall
      const score = (t) => combosOf(D, t) * 10 + choicesOf(D, t) * 6 - (usedSets.has(sig(t)) ? 100 : 0) - t.length * 2 + PLAN_W * planning(t, ordered) + OVERLAP_W * overlaps(t) - SOLO_W * soloRows(D, t);
      if (!found || score(best) > score(found)) found = best;
    }
  }
  return found;
}

function par(tie, target, firstFree = MYSTERY_PAR) {
  if (firstFree) return parFirstFree(tie, target);
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

/** Mystery levers: the first push away of each is free (the game refunds it). */
function parFirstFree(tie, target) {
  const S = 1 << tie.length;
  const sh = (s) => tie.reduce((m, t, k) => ((s >> k) & 1 ? m | t : m), 0);
  let cost = new Map([[0, 0]]); // key s*S+r
  for (const row of target) {
    const next = new Map();
    for (const [k0, c0] of cost) {
      const p = Math.floor(k0 / S), r = k0 % S;
      for (let s = 0; s < S; s++) {
        if (sh(s) !== row) continue;
        const c = c0 + pc(p ^ s) - pc(s & ~p & ~r);
        const k = s * S + (r | s);
        if (!(next.get(k) <= c)) next.set(k, c);
      }
    }
    cost = next;
  }
  return Math.min(...cost.values());
}

const ROOTS = [62, 60, 65, 67, 64, 69];
let MYSTERY_PAR = false;
/** Later chapters: a lever that is a whole row by itself makes that row a one-lever lookup (penalised). */
let SOLO_W = 0;
let PLAN_W = 0;
let OVERLAP_W = 0;
let EXTRA_CANDS = false;
const out = [];
let i = 0;
for (const ch of CHAPTERS) {
  for (const p of ch.pics) {
    const target = p.rows.map(rowVal).reverse(); // weave bottom row first
    const warps = target.map((r) => r & 255);
    const rule = p.rule ?? ch.rule;
    // past Garden: favour lever sets where planning ahead pays (row-by-row play misses par) and levers overlap
    PLAN_W = ch.id === 'garden' ? 0 : 40;
    OVERLAP_W = ch.id === 'garden' ? 0 : 4;
    EXTRA_CANDS = ch.id !== 'garden';
    // Night and the Sea come after Home: more rows that need levers together (and their par counts first tries free)
    MYSTERY_PAR = !!ch.mystery;
    SOLO_W = ch.id === 'night' || ch.id === 'sea' ? 45 : 0;
    SOLO_ROWS = warps;
    const tie = p.tie ? [...p.tie] : rule === 'parts' ? partsTieUp(warps, warps) ?? bestTieUp(warps) : bestTieUp(warps);
    if (tie) usedSets.add(sig(tie));
    if (!tie) { console.error('NOT WEAVABLE:', p.id); process.exitCode = 1; continue; }
    // Order levers so the first row's lever comes first (tutorial clarity).
    // Garden: the first row's lever first (tutorial). Parts: biggest piece first.
    if (!p.friend) tie.sort((a, b) => (warps[0] === b) - (warps[0] === a) || pc(b) - pc(a));
    // with a friend, rows holding its threads need the levers for the rest (seating it is not a lever move)
    const leverRows = p.friend ? warps.map((r) => ((r & p.friend) === p.friend ? r & ~p.friend : r)) : warps;
    if (p.friend && !canMake([...new Set(leverRows)].filter((r) => r), tie)) { console.error('FRIEND LEVEL NOT WEAVABLE:', p.id); process.exitCode = 1; }
    const pr = par(tie, leverRows);
    const combos = warps.filter((r) => !tie.includes(r)).length;
    console.log(`${ch.id.padEnd(7)} ${p.id.padEnd(10)} levers ${tie.length} rows ${target.length} combos ${combos} choices ${choicesOf(warps, tie)} par ${pr} greedy ${greedy(tie, leverRows)}  [${tie.map((m) => m.toString(2).padStart(8, '0').split('').reverse().join('').replace(/0/g, '.').replace(/1/g, '#')).join(' ')}]`);
    out.push({ id: p.id, name: p.name, chapter: ch.id, mystery: !!ch.mystery, color: p.color, ...(p.weft ? { weft: p.weft } : {}), ...(p.friend ? { friend: p.friend } : {}), picture: p.rows, tieUp: tie, target, par: pr, rootMidi: ROOTS[i++ % ROOTS.length] });
  }
}
const daily = [];
for (const p of DAILY) {
  const target = p.rows.map(rowVal).reverse();
  const warps = target.map((r) => r & 255);
  PLAN_W = 40;
  OVERLAP_W = 4;
  EXTRA_CANDS = true;
  MYSTERY_PAR = false;
  SOLO_W = 0;
  SOLO_ROWS = warps;
  const tie = partsTieUp(warps, warps) ?? bestTieUp(warps);
  if (!tie) { console.error('NOT WEAVABLE:', p.id); process.exitCode = 1; continue; }
  usedSets.add(sig(tie));
  tie.sort((a, b) => pc(b) - pc(a));
  const pr = par(tie, warps);
  console.log(`daily   ${p.id.padEnd(10)} levers ${tie.length} rows ${target.length} combos ${warps.filter((r) => !tie.includes(r)).length} choices ${choicesOf(warps, tie)} par ${pr}`);
  daily.push({ id: `day-${p.id}`, name: p.name, chapter: 'daily', mystery: false, color: p.color, picture: p.rows, tieUp: tie, target, par: pr, rootMidi: ROOTS[i++ % ROOTS.length] });
}
const chapters = CHAPTERS.map((c) => ({ id: c.id, name: c.name, idea: c.idea, levels: c.pics.map((p) => p.id) }));
const hex = (j) => j.replace(/"(color|weft)": (\d+)/g, (_, k, n) => `"${k}": 0x${(+n).toString(16).padStart(6, '0')}`);
const ts = `// GENERATED by tools/derive-tieups.mjs — do not edit by hand.
// Garden: the smallest lever set (≤ 4) that weaves every row, preferring whole
// picture rows. Home/Night/Sea: levers are readable parts (runs, mirrored runs)
// chosen so most rows need levers combined. tests/pictures.test.ts re-verifies.
import type { PictureLevel, Chapter } from './pictures.js';

export const CHAPTERS: Chapter[] = ${JSON.stringify(chapters, null, 2)};

export const PICTURES: PictureLevel[] = ${hex(JSON.stringify(out, null, 2))};

/** The picture of the day, in order (one a day for everyone). */
export const DAILY: PictureLevel[] = ${hex(JSON.stringify(daily, null, 2))};
`;
writeFileSync(new URL('../src/puzzle/pictures.gen.ts', import.meta.url), ts);
console.log(`wrote ${out.length} levels, ${daily.length} daily pictures`);
