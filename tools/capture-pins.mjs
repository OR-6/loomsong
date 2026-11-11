#!/usr/bin/env node
// Capture the caller's pins on the loom and Pip waving. Usage: node tools/capture-pins.mjs OUT_DIR
import { execFileSync } from 'node:child_process';
import { freshSession, setTable, run, wait } from './e2e-lib.mjs';
const out = process.argv[2] ?? '.';
await freshSession();
await setTable();
await wait(1500);
run('tools/pins-state.mjs');
execFileSync('node', ['tools/look-at.mjs', '0', '0.2', '0.3', '0', '0.02', '-0.03', `${out}/pins.png`]);
run('tools/pins-state.mjs');
execFileSync('node', ['tools/look-at.mjs', '0.02', '0.14', '0.24', '-0.12', '0.03', '-0.02', `${out}/pip-wave.png`]);
