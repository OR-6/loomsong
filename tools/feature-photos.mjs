#!/usr/bin/env node
// Gallery stills of two newer ideas, on the warm photo set: a row woven by ear (the felt patch on the
// card, Pip humming, the threads quivering) and a visitor (the present set down beside the plush it
// came to see, with its notice). Writes artifacts/gallery/18-by-ear.jpg and 19-visitor.jpg.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { cli, run, xr, wait, freshSession, setTable, HAND, FLAT } from './e2e-lib.mjs';

const GALLERY = 'artifacts/gallery';
const TMP = 'artifacts/feature-raw';
mkdirSync(TMP, { recursive: true });
mkdirSync(GALLERY, { recursive: true });
const weave = () => execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/weave-row.mjs'], { encoding: 'utf8' });
const go = (q) => execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/goto-params.mjs'], { encoding: 'utf8', env: { ...process.env, GOTO_SEARCH: q } });
const crop = (name, out) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${TMP}/${name}.png`, '-vf', 'crop=1080:720:100:0,scale=1500:1000:flags=lanczos', '-q:v', '2', `${GALLERY}/${out}`]);
const away = (O) => {
  xr('set-transform', { device: 'hand-left', position: { x: O[0] - 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
  xr('set-transform', { device: HAND, position: { x: O[0] + 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
};
const look = (O, p, t, fov) => {
  xr('set-device-state', { state: { fov } });
  xr('set-transform', { device: 'headset', position: { x: O[0] + p[0], y: O[1] + p[1], z: O[2] + p[2] } });
  xr('look-at', { device: 'headset', target: { x: O[0] + t[0], y: O[1] + t[1], z: O[2] + t[2] } });
};

// 1. by ear: the House, woven up to its hidden row; shot just after Pip starts humming
await freshSession();
await setTable();
let O = run('tools/state.mjs').debug.loomOrigin;
run('tools/photo-on.mjs');
run('tools/seed-home-two.mjs');
await wait(1200);
const e = run('tools/ear-state.mjs');
for (let i = 0; i < 10 && run('tools/ear-state.mjs').rows < e.earRow; i++) {
  weave();
  await wait(1300);
}
away(O);
look(O, [0.02, 0.27, 0.42], [0, 0.11, -0.08], 46);
await wait(1100);
cli('browser', 'screenshot', '--output-file', `${TMP}/ear.png`);
crop('ear', '18-by-ear.jpg');
console.log('shot ear');

// 2. a visitor: ?visit=1 puts the Sprout on the desk and the Ladybug's present beside it
run('tools/clear-storage.mjs');
go('?visit=1');
await wait(4500);
if (!xr('status').sessionActive) xr('enter');
xr('set-input-mode', { mode: 'hand' });
xr('set-transform', { device: 'headset', position: { x: 0, y: 1.2, z: 0 }, orientation: { pitch: 0, yaw: 0, roll: 0 } });
await setTable();
O = run('tools/state.mjs').debug.loomOrigin;
run('tools/photo-on.mjs');
away(O);
await wait(2600);
const v = run('tools/visit-state.mjs');
const sp = v.placed.sprout ?? [0.2, 0.19];
const mx = (sp[0] + (v.gift?.[0] ?? sp[0])) / 2; // between the plush and its visitor's present
const mz = (sp[1] + (v.gift?.[1] ?? sp[1])) / 2;
look(O, [mx + 0.1, 0.15, mz + 0.22], [mx + 0.075, 0.035, mz - 0.01], 38);
await wait(900);
cli('browser', 'screenshot', '--output-file', `${TMP}/visit.png`);
crop('visit', '19-visitor.jpg');
console.log('shot visitor');
xr('set-device-state', { state: { fov: 90 } });
process.env.PHOTO = '0';
run('tools/photo-on.mjs');
go('');
await wait(4000);
