#!/usr/bin/env node
// Re-records the landing page's gameplay clip (the Duck woven to the end, the plush
// dancing) on the photo set. Usage: node tools/site-clip.mjs [OUT=public/site/loom-clip.mp4]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { run, xr, wait, freshSession, setTable, HAND } from './e2e-lib.mjs';

const OUT = process.argv[2] ?? 'public/site/loom-clip.mp4';
const FR = 'artifacts/clip-frames';
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });
await freshSession();
await setTable();
const O = run('tools/state.mjs').debug.loomOrigin;
run('tools/photo-on.mjs');
run('tools/seed-midgame.mjs'); // the Duck, with Sprout and Tulip on the shelf
await wait(1200);
xr('set-transform', { device: 'hand-left', position: { x: O[0] - 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: 90 } });
xr('set-transform', { device: HAND, position: { x: O[0] + 0.9, y: O[1] + 0.6, z: O[2] + 0.9 }, orientation: { pitch: 0, yaw: 0, roll: -90 } });
xr('set-device-state', { state: { fov: 54 } });
xr('set-transform', { device: 'headset', position: { x: O[0] + 0.06, y: O[1] + 0.27, z: O[2] + 0.46 } });
xr('look-at', { device: 'headset', target: { x: O[0] - 0.01, y: O[1] + 0.05, z: O[2] + 0.02 } });
await wait(800);
execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/clip-arm.mjs'], { env: { ...process.env, DELAY: '1200' }, encoding: 'utf8' });
execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/clip-frames.mjs'], { env: { ...process.env, OUT: FR, SECS: '22', FPS: '12' }, encoding: 'utf8', timeout: 120000 });
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '12', '-i', `${FR}/f%04d.jpg`, '-vf', 'crop=1209:680:36:40,scale=960:540,format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', '-an', OUT]);
xr('set-device-state', { state: { fov: 90 } });
process.env.PHOTO = '0';
run('tools/photo-on.mjs'); // photo set off again
console.log('wrote', OUT);
