#!/usr/bin/env node
// Capture the friend picture: the empty cushion, then a plush seated lifting its threads. Usage: node tools/capture-friend.mjs OUTDIR
import { execFileSync } from 'node:child_process';
import { run, wait, freshSession, setTable } from './e2e-lib.mjs';
const OUT = process.argv[2] ?? '.';
const F = (action) => JSON.parse(execFileSync('npx', ['@iwsdk/cli', 'browser', 'run', 'tools/friend-state.mjs'], { encoding: 'utf8', env: { ...process.env, FRIEND_ACTION: action } })).data.result;
await freshSession();
await setTable();
await wait(1000);
F('seed');
F('row');
F('row');
const o = run('tools/state.mjs').debug.loomOrigin;
const shot = (name) => execFileSync('node', ['tools/shot-at.mjs', String(o[0] + 0.06), String(o[1] + 0.3), String(o[2] + 0.42), String(o[0] + 0.04), String(o[1] + 0.03), String(o[2] + 0.02), '55', `${OUT}/${name}.png`]);
shot('friend-ask');
F('seat');
await wait(400);
shot('friend-seated');
