/**
 * Step-zero probe (temporary). Publishes raw hand-joint, head, plane and
 * session data on window.__probe so the IWSDK CLI (`browser run`) can read
 * live emulator values. Not part of the game.
 */
import { createSystem, Vector3, XRPlane } from '@iwsdk/core';

const JOINTS = [
  'wrist',
  'thumb-tip',
  'index-finger-tip',
  'middle-finger-metacarpal',
] as const;

type Probe = {
  frames: number;
  refSpaceType: string | null;
  sessionMode: string | null;
  frameRate: number | null;
  supportedFrameRates: number[] | null;
  enabledFeatures: string[] | null;
  head: number[] | null;
  cameraWorld: number[] | null;
  playerWorld: number[] | null;
  hands: Record<string, Record<string, number[] | null> & { pinchMm?: number }>;
  indexTipSpace: Record<string, number[]>;
  planes: Array<{
    orientation: string;
    label: string | undefined;
    pos: number[];
    polygonPts: number;
  }>;
  visibility: string;
  storage: string;
};

export class ProbeSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  private v = new Vector3();
  private data!: Probe;

  init() {
    let storage = 'unknown';
    try {
      localStorage.setItem('__probe', '1');
      storage = localStorage.getItem('__probe') === '1' ? 'ok' : 'mismatch';
      localStorage.removeItem('__probe');
    } catch (e) {
      storage = 'threw: ' + String(e);
    }
    this.data = {
      frames: 0,
      refSpaceType: null,
      sessionMode: null,
      frameRate: null,
      supportedFrameRates: null,
      enabledFeatures: null,
      head: null,
      cameraWorld: null,
      playerWorld: null,
      hands: {},
      indexTipSpace: {},
      planes: [],
      visibility: '',
      storage,
    };
    (window as unknown as { __probe: Probe }).__probe = this.data;
  }

  update() {
    const d = this.data;
    d.frames++;
    d.visibility = String(this.visibilityState.peek());
    this.camera.getWorldPosition(this.v);
    d.cameraWorld = this.v.toArray().map(round);
    this.player.getWorldPosition(this.v);
    d.playerWorld = this.v.toArray().map(round);
    this.player.head.getWorldPosition(this.v);
    d.head = this.v.toArray().map(round);
    for (const side of ['left', 'right'] as const) {
      this.player.indexTipSpaces[side].getWorldPosition(this.v);
      d.indexTipSpace[side] = this.v.toArray().map(round);
    }

    const frame = this.xrFrame;
    const session = frame?.session;
    const ref = this.renderer.xr.getReferenceSpace();
    if (!frame || !session || !ref) return;
    d.sessionMode = (session as unknown as { mode?: string }).mode ?? 'n/a';
    d.frameRate = session.frameRate ?? null;
    d.supportedFrameRates = session.supportedFrameRates
      ? Array.from(session.supportedFrameRates)
      : null;
    d.enabledFeatures = session.enabledFeatures
      ? Array.from(session.enabledFeatures)
      : null;
    d.refSpaceType =
      (this.renderer.xr as unknown as { _refType?: string })._refType ??
      'see config';

    for (const src of session.inputSources) {
      if (!src.hand) continue;
      const out: Record<string, number[] | null> & { pinchMm?: number } = {};
      for (const j of JOINTS) {
        const space = src.hand.get(j);
        const pose = space ? frame.getJointPose?.(space, ref) : undefined;
        out[j] = pose
          ? [
              pose.transform.position.x,
              pose.transform.position.y,
              pose.transform.position.z,
              pose.radius ?? -1,
            ].map(round)
          : null;
      }
      const t = out['thumb-tip'];
      const i = out['index-finger-tip'];
      if (t && i) {
        out.pinchMm = round(
          Math.hypot(t[0] - i[0], t[1] - i[1], t[2] - i[2]) * 1000,
        );
      }
      const ws = src.hand.get('wrist');
      const wp = ws ? frame.getJointPose?.(ws, ref) : undefined;
      if (wp) {
        const q = wp.transform.orientation;
        // +Y axis of the wrist joint in reference space
        this.v.set(0, 1, 0).applyQuaternion(
          new (this.camera.quaternion.constructor as any)(q.x, q.y, q.z, q.w),
        );
        out.wristUp = this.v.toArray().map(round);
      }
      d.hands[src.handedness] = out;
    }

    d.planes.length = 0;
    for (const e of this.queries.planes.entities) {
      const p = e.getValue(XRPlane, '_plane') as
        | (XRPlane & { semanticLabel?: string })
        | undefined;
      e.object3D?.getWorldPosition(this.v);
      d.planes.push({
        orientation: p?.orientation ?? '?',
        label: p?.semanticLabel,
        pos: this.v.toArray().map(round),
        polygonPts: p?.polygon?.length ?? 0,
      });
    }
  }
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}
