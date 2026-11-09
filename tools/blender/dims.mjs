#!/usr/bin/env node
// Writes tools/blender/dims.json from src/config.ts so models match gameplay.
import { writeFileSync } from 'node:fs';
const cfg = await import('../../src/config.ts');
const { LOOM, LEVER, LEVERS, SHUTTLE, BOBBIN, CARD, TOKEN, WARPS, WARP_PITCH } = cfg;
writeFileSync(new URL('./dims.json', import.meta.url), JSON.stringify({ LOOM, LEVER, LEVERS, SHUTTLE, BOBBIN, CARD, TOKEN, WARPS, WARP_PITCH }, null, 2));
console.log('dims.json written');
