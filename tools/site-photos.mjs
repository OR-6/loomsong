#!/usr/bin/env node
// Regenerates the landing page's photos from the current build, on the warm photo set
// (maple desk, soft backdrop). Usage: node tools/site-photos.mjs [OUTDIR=public/site]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, freshSession, setTable, HAND } from './e2e-lib.mjs';

const OUT = process.argv[2] ?? 'public/site';
/** The Devpost gallery (3:2), kept out of the site. */
const GALLERY = process.env.GALLERY ?? 'artifacts/gallery';
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
let lastShot = null;
const shoot = async (name, p, t, fov, settle = 700) => {
  lastShot = { p, t, fov };
  xr('set-device-state', { state: { fov } });
  xr('set-transform', { device: 'headset', position: { x: O[0] + p[0], y: O[1] + p[1], z: O[2] + p[2] } });
  xr('look-at', { device: 'headset', target: { x: O[0] + t[0], y: O[1] + t[1], z: O[2] + t[2] } });
  await wait(settle);
  cli('browser', 'screenshot', '--output-file', `${TMP}/${name}.png`);
  console.log('shot', name);
};
/** A 3:2 gallery still (1500x1000) from a raw frame: the middle 1080x720. */
const gallery = async (name, out, frame = null) => {
  mkdirSync(GALLERY, { recursive: true });
  // re-shoot the last view a little wider (or as `frame` says), so the 3:2 crop keeps every tag whole
  const f = frame ?? { ...lastShot, fov: lastShot.fov * 1.16 };
  xr('set-device-state', { state: { fov: f.fov } });
  xr('set-transform', { device: 'headset', position: { x: O[0] + f.p[0], y: O[1] + f.p[1], z: O[2] + f.p[2] } });
  xr('look-at', { device: 'headset', target: { x: O[0] + f.t[0], y: O[1] + f.t[1], z: O[2] + f.t[2] } });
  // a picture still being woven keeps its name a surprise: its place in the chapter on the plate ('Garden · 2 of 4'), as in play
  evalJs(`const g = window.__loom.game; g.hideHints = true; if (g.flow.phase === 'play') g.view.plaque.set(g.surprisePlateNow()); return 1;`);
  await wait(350);
  cli('browser', 'screenshot', '--output-file', `${TMP}/g-${name}.png`);
  evalJs(`window.__loom.game.hideHints = false; return 1;`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/g-${name}.png`, '-vf', 'crop=1080:720:100:0,scale=1500:1000:flags=lanczos', '-q:v', '2', `${GALLERY}/${out}`]);
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

// 0. the first minute: only the loom, the card, Pip and two levers on the desk
evalJs(`window.__loom.game.hideHints = true; return 1;`);
await shoot('start', [0.06, 0.3, 0.5], [0.0, 0.03, 0.0], 50, 900);
await gallery('start', '05-the-first-minute.jpg', { p: [0.12, 0.27, 0.44], t: [0.07, 0.04, -0.04], fov: 58 }); // both levers in
evalJs(`window.__loom.game.hideHints = false; return 1;`);

// 1. the first lever lifts its threads (level 1)
evalJs(`const g = window.__loom.game; const c = g.controller; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); c.toggleLever(0); for (let r = 0; r < 2; r++) { const n = g.model.rows.length; c.throwShuttle(); for (let w = 0; w < 40 && g.model.rows.length <= n; w++) await sleep(100); await sleep(300); } await sleep(8200); c.toggleLever(1); await sleep(900); g.tutor.mesh.visible = false; g.banner.mesh.visible = false; return g.model.rows.length;`);
await shoot('levers', [0.3, 0.33, 0.33], [0.11, 0.03, -0.01], 50, 300);
evalJs(`const g = window.__loom.game; g.tutor.mesh.visible = true; return 1;`);
save('levers', 'levers-close.jpg', 800, 600, 960, 720);
await gallery('levers', '07-levers.jpg');

// 2. the ghost hand shows how to pinch Pip (the shuttle step)
// Pip follows the ghost hand's demo slide for a moment (capture only), so the hand pinches Pip mid-slide;
// a few frames are kept (PIP=a|b|c|d picks; default b)
evalJs(`const g = window.__loom.game; g.tutor.mesh.visible = false; return 1;`); // the caption says it: no tag in the photo
evalJs(`const g = window.__loom.game; const c = g.controller; const lo = -0.168, hi = 0.168; const end = performance.now() + 6000; const follow = () => { const x = g.view.ghost.root.position.x; if (g.view.ghost.root.visible) c.shuttle.t = Math.max(0, Math.min(0.62, (x + 0.02 - lo) / (hi - lo))); if (performance.now() < end) requestAnimationFrame(follow); }; requestAnimationFrame(follow); return 1;`);
await wait(900);
for (const k of ['a', 'b', 'c', 'd']) await shoot(`pip-${k}`, [-0.02, 0.27, 0.34], [-0.03, 0.04, 0.0], 50, 420);
save(`pip-${process.env.PIP ?? 'b'}`, 'pip-pinch.jpg', 800, 600, 960, 720);
for (const k of ['a', 'b', 'c', 'd']) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/pip-${k}.png`, '-vf', 'crop=1080:720:100:0,scale=1500:1000:flags=lanczos', '-q:v', '2', `${GALLERY}/.hand-${k}.jpg`]);
execFileSync('cp', [`${GALLERY}/.hand-${process.env.HAND ?? 'a'}.jpg`, `${GALLERY}/04-a-hand-shows-how.jpg`]); // 'a': the ghost hand pinching Pip on the loom
for (const k of ['a', 'b', 'c', 'd']) save(`pip-${k}`, `.pip-${k}.jpg`, 400, 300, 960, 720);

// 3. the hero: Home, with plushes on the shelf and the desk
run('tools/seed-desk.mjs');
await wait(1500);
hands();
await shoot('hero', [0.14, 0.3, 0.56], [0.03, 0.02, 0.06], 56, 1200);
save('hero', 'hero-34.jpg', 1100, 618);
await gallery('hero', '06-loom-on-your-desk.jpg', { p: [0.08, 0.27, 0.56], t: [0.05, 0.04, 0.0], fov: 72 }); // every prop whole, the telephone's tag too
save('hero', 'og.jpg', 1200, 630, 1280, 672);
save('hero', 'loom-clip-poster.jpg', 960, 540);

// 4. the shelf and the desk: plushes where you put them, the present beside the basket
await shoot('shelf', [-0.12, 0.22, 0.44], [-0.27, 0.03, 0.1], 52);
save('shelf', 'shelf.jpg', 800, 500, 1152, 720);
await gallery('shelf', '09-shelf-and-desk.jpg', { p: [-0.08, 0.25, 0.48], t: [-0.2, 0.04, 0.04], fov: 64 });

// 5. the Duck comes alive and dances
// a clean desk for it (no second Duck): the Sprout and the Tulip on the shelf, the Duck on the loom, woven in par
evalJs(`const g = window.__loom.game; g.controller.releaseAll(); g.progress.best = { sprout: 3, tulip: 3 }; g.progress.placed = {}; g.flow.start(2); await new Promise((r) => setTimeout(r, 700)); return 1;`);
run('tools/solve-best.mjs');
await wait(1500); // mid-dance, with its name on the ribbon
evalJs(`window.__loom.game.hideHints = true; return 1;`);
await shoot('dance', [0, 0.26, 0.56], [0, 0.1, 0.1], 52, 200);
evalJs(`window.__loom.game.hideHints = false; return 1;`);
save('dance', 'plush-dance.jpg', 800, 600, 960, 720);
// the dance is a moment: crop the gallery still from the same frame instead of re-shooting it
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/dance.png`, '-vf', 'crop=1068:712:106:4,scale=1500:1000:flags=lanczos', '-q:v', '2', `${GALLERY}/01-picture-comes-alive.jpg`]); // tighter: no empty desk below
await wait(9000);

// 6. Sea: a boat on two colours of yarn
run('tools/seed-sea-boat.mjs');
await wait(1200);
evalJs(`const g = window.__loom.game; const lv = g.flow.level; const c = g.controller; const n = lv.tieUp.length; const pick = (row) => { for (let s = 0; s < 1 << n; s++) { let m = 0; for (let k = 0; k < n; k++) if (s & (1 << k)) m |= lv.tieUp[k]; if (m === row) return s; } return 0; }; for (let r = 0; r < 4; r++) { const s = pick(lv.target[r] & 255); for (let k = 0; k < n; k++) if (!!(s & (1 << k)) !== g.model.latched[k]) c.toggleLever(k); g.model.setWeft(lv.target[r] & 256 ? 1 : 0); c.throwShuttle(); for (let w = 0; w < 40 && g.model.rows.length <= r; w++) await new Promise((q) => setTimeout(q, 100)); await new Promise((q) => setTimeout(q, 300)); } return g.model.rows.length;`);
hands();
await shoot('sea', [0.02, 0.32, 0.34], [0, 0.04, -0.04], 52);
save('sea', 'sea-boat.jpg', 800, 500, 1152, 720);
await gallery('sea', '10-sea-two-colours.jpg');

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
// the friend photo is about the cushion: the present and the telephone (and their tags) stay out of the frame's edges
evalJs(`const v = window.__loom.game.view; v.phone.root.position.y -= 5; v.daily.root.position.y -= 5; return 1;`);
await gallery('friend', '02-plushes-help.jpg');
evalJs(`const v = window.__loom.game.view; v.phone.root.position.y += 5; v.daily.root.position.y += 5; return 1;`);
// 8. the picture card up close: hand-stamped squares, the move knots as yarn bows
await shoot('card', [0.0, 0.2, 0.2], [0.0, 0.15, -0.23], 34);
await gallery('card', '08-picture-card.jpg', { p: [0.0, 0.2, 0.2], t: [0.0, 0.15, -0.23], fov: 34 });
// 9. call a friend: the toy telephone with its code (the line shown as open, for the photo)
evalJs(`const g = window.__loom.game; g.view.phone.setState('calling', 'KDXW'); return 1;`);
await shoot('phone', [0.2, 0.2, 0.42], [0.33, 0.02, 0.17], 40);
await gallery('phone', '11-call-a-friend.jpg', { p: [0.34, 0.24, 0.52], t: [0.31, 0.035, 0.11], fov: 42 }); // the telephone up front, the lever box and the loom behind it
evalJs(`const g = window.__loom.game; g.view.phone.setState('idle'); return 1;`);

// 11. the present of the day: wrapped, with its Today tag, wherever today's spot is
run('tools/seed-garden-three.mjs');
await wait(900);
// the photo puts it on its open spot in front of the basket, as on one of its days
const gift = evalJs(`const g = window.__loom.game; g.syncDaily(); const s = g.controller.bankSide; g.giftAt[0] = -s * 0.2; g.giftAt[1] = 0.25; g.view.setGiftSpot(g.giftAt[0], g.giftAt[1]); return g.giftAt;`);
hands();
await shoot('gift', [gift[0] * 0.4, 0.16, gift[1] + 0.2], [gift[0] * 0.8, 0.02, gift[1] - 0.04], 46);
await gallery('gift', '13-present-of-the-day.jpg', { p: [gift[0] * 0.75, 0.15, gift[1] + 0.21], t: [gift[0] * 1.15, 0.035, gift[1] - 0.1], fov: 44 }); // tight: the present, the basket and the shelf, no bare desk

// 10. Night: what a lever lifts stays hidden until you try it (one tried and dyed, the rest undyed wool)
run('tools/seed-night.mjs');
await wait(900);
hands();
await shoot('night', [0.24, 0.3, 0.36], [0.06, 0.03, -0.02], 52);
await gallery('night', '03-night-deduce-the-levers.jpg');

// 12. Look to play: no hands; the felt dot grows on the lever you're looking at (caught mid-look, before it presses)
run('tools/seed-desk.mjs');
await wait(1200);
hands();
{
  const L = run('tools/state.mjs').targets.lever1;
  const t = [L[0] - O[0], L[1] - O[1], L[2] - O[2]];
  xr('set-device-state', { state: { fov: 50 } });
  xr('set-transform', { device: 'headset', position: { x: O[0] + t[0] - 0.12, y: O[1] + t[1] + 0.2, z: O[2] + t[2] + 0.36 } });
  // the look aims ~12° below head-forward (to spare the neck): aim the head that much above the lever
  xr('look-at', { device: 'headset', target: { x: L[0], y: L[1] + Math.hypot(0.12, 0.2, 0.36) * Math.tan((12 * Math.PI) / 180), z: L[2] } });
  // wait in the page until the ring is two-thirds round, then hold the moment for the photo
  // Look to play goes on only now, with the head already aimed (a dwell is 1 s: it would press before the camera got there)
  evalJs(`const g = window.__loom.game; g.setPaused(false); g.settings = { ...g.settings, lookToPlay: true }; g.lookReset(); g.hideHints = true; const d = g.view.gazeDot; let ok = false; for (let i = 0; i < 300; i++) { if (d.visible && d.children.filter((b) => b.visible).length >= 8) { ok = true; break; } await new Promise((r) => setTimeout(r, 10)); } g.setPaused(true); if (!ok) throw new Error('no gaze ring for the Look to play photo'); return 1;`);
  cli('browser', 'screenshot', '--output-file', `${TMP}/g-look.png`);
  evalJs(`const g = window.__loom.game; g.setPaused(false); g.hideHints = false; g.settings = { ...g.settings, lookToPlay: false }; return 1;`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/g-look.png`, '-vf', 'crop=1080:720:100:0,scale=1500:1000:flags=lanczos', '-q:v', '2', `${GALLERY}/14-look-to-play.jpg`]);
  console.log('shot look');
}

xr('set-device-state', { state: { fov: 90 } });
process.env.PHOTO = '0';
run('tools/photo-on.mjs'); // photo set off again
if (!process.env.KEEP) execFileSync('rm', ['-rf', TMP]);
console.log('done');
