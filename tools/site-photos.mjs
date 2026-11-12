#!/usr/bin/env node
// Regenerates the landing page's photos from the current build, on the warm photo set
// (maple desk, soft backdrop). Usage: node tools/site-photos.mjs [OUTDIR=public/site]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, freshSession, setTable, HAND } from './e2e-lib.mjs';

const OUT = process.argv[2] ?? 'public/site';
const TMP = `${OUT}/.raw`;
mkdirSync(TMP, { recursive: true });
let O = null;
const evalJs = (src) => {
  // run a small snippet in the page (via a throwaway tool file)
  const f = 'tools/_snip.mjs';
  execFileSync('bash', ['-c', `cat > ${f} <<'EOF'\nexport default async function run({ page, frame }) { return await (frame ?? page).evaluate(async () => { ${src} }); }\nEOF`]);
  try {
    return run(f);
  } finally {
    execFileSync('rm', ['-f', f]);
  }
};
const hands = () => {
  xr('set-transform', { device: 'hand-left', position: { x: O[0] - 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
  xr('set-transform', { device: HAND, position: { x: O[0] + 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
};
/** Camera at loom-relative `p`, looking at `t`, `fov`; save a 1280x720 frame as `name`. */
const shoot = async (name, p, t, fov, settle = 700) => {
  xr('set-device-state', { state: { fov } });
  xr('set-transform', { device: 'headset', position: { x: O[0] + p[0], y: O[1] + p[1], z: O[2] + p[2] } });
  xr('look-at', { device: 'headset', target: { x: O[0] + t[0], y: O[1] + t[1], z: O[2] + t[2] } });
  await wait(settle);
  cli('browser', 'screenshot', '--output-file', `${TMP}/${name}.png`);
  console.log('shot', name);
};
/** Crop the middle `cw`x`ch` of a raw frame and scale to `w`x`h` as a JPEG. */
const save = (name, out, w, h, cw = 1280, ch = 720, dy = 0) => {
  const x = Math.round((1280 - cw) / 2);
  const y = Math.round((720 - ch) / 2 + dy);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/${name}.png`, '-vf', `crop=${cw}:${ch}:${x}:${y},scale=${w}:${h}`, '-q:v', '3', `${OUT}/${out}`]);
};

await freshSession();
await setTable();
O = run('tools/state.mjs').debug.loomOrigin;
run('tools/photo-on.mjs');
hands();

// 1. the first lever lifts its threads (level 1)
evalJs(`const g = window.__loom.game; const c = g.controller; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); c.toggleLever(0); for (let r = 0; r < 2; r++) { const n = g.model.rows.length; c.throwShuttle(); for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100); await sleep(300); } await sleep(8200); c.toggleLever(1); await sleep(900); g.tutor.mesh.visible = false; g.banner.mesh.visible = false; return g.model.rows.length;`);
await shoot('levers', [0.3, 0.33, 0.33], [0.11, 0.03, -0.01], 50, 300);
evalJs(`const g = window.__loom.game; g.tutor.mesh.visible = true; return 1;`);
save('levers', 'levers-close.jpg', 800, 600, 960, 720);

// 2. the ghost hand shows how to pinch Pip (the shuttle step)
// Pip follows the ghost hand's demo slide for a moment (capture only), so the hand pinches Pip mid-slide;
// a few frames are kept (PIP=a|b|c|d picks; default b)
evalJs(`const g = window.__loom.game; g.tutor.mesh.visible = false; return 1;`); // the caption says it: no tag in the photo
evalJs(`const g = window.__loom.game; const c = g.controller; const lo = -0.168, hi = 0.168; const end = performance.now() + 6000; const follow = () => { const x = g.view.ghost.root.position.x; if (g.view.ghost.root.visible) c.shuttle.t = Math.max(0, Math.min(0.62, (x + 0.02 - lo) / (hi - lo))); if (performance.now() < end) requestAnimationFrame(follow); }; requestAnimationFrame(follow); return 1;`);
await wait(900);
for (const k of ['a', 'b', 'c', 'd']) await shoot(`pip-${k}`, [-0.02, 0.27, 0.34], [-0.03, 0.04, 0.0], 50, 420);
save(`pip-${process.env.PIP ?? 'b'}`, 'pip-pinch.jpg', 800, 600, 960, 720);
for (const k of ['a', 'b', 'c', 'd']) save(`pip-${k}`, `.pip-${k}.jpg`, 400, 300, 960, 720);

// 3. the hero: Home, with plushes on the shelf and the desk
run('tools/seed-desk.mjs');
await wait(1500);
hands();
await shoot('hero', [0.14, 0.3, 0.56], [0.03, 0.02, 0.06], 56, 1200);
save('hero', 'hero-34.jpg', 1100, 618);
save('hero', 'og.jpg', 1200, 630, 1280, 672);
save('hero', 'loom-clip-poster.jpg', 960, 540);

// 4. the shelf and the desk: plushes where you put them, the present beside the basket
await shoot('shelf', [-0.12, 0.22, 0.44], [-0.27, 0.03, 0.1], 52);
save('shelf', 'shelf.jpg', 800, 500, 1152, 720);

// 5. the Duck comes alive and dances
evalJs(`const g = window.__loom.game; g.controller.releaseAll(); g.flow.start(2); await new Promise((r) => setTimeout(r, 600)); return 1;`);
run('tools/solve-nowait.mjs');
await wait(2600);
await shoot('dance', [0, 0.26, 0.56], [0, 0.1, 0.1], 52, 200);
save('dance', 'plush-dance.jpg', 800, 600, 960, 720);
await wait(9000);

// 6. Sea: a boat on two colours of yarn
run('tools/seed-sea-boat.mjs');
await wait(1200);
evalJs(`const g = window.__loom.game; const lv = g.flow.level; const c = g.controller; const n = lv.tieUp.length; const pick = (row) => { for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m === row) return s; } return 0; }; for (let r = 0; r < 4; r++) { const s = pick(lv.target[r] & 255); for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); g.model.setWeft(lv.target[r] & 256 ? 1 : 0); c.throwShuttle(); for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await new Promise((q) => setTimeout(q, 100)); await new Promise((q) => setTimeout(q, 300)); } return g.model.rows.length;`);
hands();
await shoot('sea', [0.02, 0.32, 0.34], [0, 0.04, -0.04], 52);
save('sea', 'sea-boat.jpg', 800, 500, 1152, 720);

// 7. your plushes help: the Sprout on the felt cushion lifts the middle threads for the Table
const F = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/friend-state.mjs'], { encoding: 'utf8', env: { ...process.env, FRIEND_ACTION: action, FRIEND_LEVEL: 'table', FRIEND_ID: 'sprout' } })).data.result;
F('seed');
F('row');
F('row');
F('seat');
F('row'); // the tabletop, woven with the friend's help
hands();
await wait(600);
await shoot('friend', [0.1, 0.26, 0.5], [0.06, 0.03, 0.06], 50);
save('friend', 'plush-friend.jpg', 800, 500, 1152, 720);

xr('set-device-state', { state: { fov: 90 } });
process.env.PHOTO = '0';
run('tools/photo-on.mjs'); // photo set off again
if (!process.env.KEEP) execFileSync('rm', ['-rf', TMP]);
console.log('done');
