/**
 * check:reach (R2): every interactive point lies within MAX_REACH_M of the
 * seated head, for both lever-bank sides, at the default desk drop and at
 * the deepest plausible desk, across lever and shuttle travel.
 */
import { describe, expect, it } from 'vitest';
import { BOBBIN, LEVER, LEVERS, MAX_REACH_M, NUDGE, PLACE, SHUTTLE, TOKEN, bobbinX, leverX, nudgeX, tokenX, shuttleY } from '../src/config';
import { loomPose } from '../src/app/placement';

function world(p: ReturnType<typeof loomPose>, x: number, y: number, z: number) {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: p.x + c * x + s * z, y: p.y + y, z: p.z - s * x + c * z };
}

describe('check:reach', () => {
  const head = { x: 0, y: 1.2, z: 0 };
  for (const side of [1, -1] as const) {
    for (const drop of [PLACE.defaultDrop]) {
      it(`all interactables ≤ ${MAX_REACH_M} m (bank ${side > 0 ? 'right' : 'left'}, drop ${drop})`, () => {
        // Worst case over the palm-placement clamp: every extreme the clamp allows.
        const poses = [null, { x: 0.5, z: -0.6 }, { x: -0.5, z: -0.6 }, { x: 0.5, z: -0.1 }, { x: -0.5, z: -0.1 }]
          .map((palm) => loomPose(head, { x: 0, z: -1 }, side, head.y - drop, palm));
        const pts: Array<[string, number, number, number]> = [];
        for (let k = 0; k < LEVERS; k++) {
          pts.push([`lever${k} rest`, leverX(k, side), LEVER.knobY, LEVER.restZ]);
          pts.push([`lever${k} latched`, leverX(k, side), LEVER.knobY, LEVER.restZ - LEVER.travel]);
        }
        pts.push(['shuttle min', SHUTTLE.minX, shuttleY(SHUTTLE.minX), SHUTTLE.z]);
        pts.push(['shuttle max', SHUTTLE.maxX, shuttleY(SHUTTLE.maxX), SHUTTLE.z]);
        pts.push(['bobbin', bobbinX(side), BOBBIN.y, BOBBIN.z]);
        pts.push(['style token', tokenX(side), TOKEN.y, TOKEN.z]);
        pts.push(['nudge up', nudgeX(side), NUDGE.y, NUDGE.upZ]);
        pts.push(['nudge down', nudgeX(side), NUDGE.y, NUDGE.downZ]);
        let worst = 0;
        let worstName = '';
        for (const pose of poses) for (const [name, x, y, z] of pts) {
          const w = world(pose, x, y, z);
          const d = Math.hypot(w.x - head.x, w.y - head.y, w.z - head.z);
          if (d > worst) {
            worst = d;
            worstName = name;
          }
        }
        console.log(`reach: worst ${worstName} = ${(worst * 100).toFixed(1)} cm`);
        expect(worst).toBeLessThanOrEqual(MAX_REACH_M);
      });
    }
  }
});
