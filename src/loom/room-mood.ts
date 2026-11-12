/**
 * The chapter reaches into the real room. Night: the room around the loom
 * dims to dusk (a dark veil over the passthrough, behind every toy; the loom
 * stays bright). Sea: soft light ripples drift across the real table. Both
 * fade in and out with the chapter and switch off when frames are tight.
 */
import {
  BackSide,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { motion } from '../ui/motion.js';

export class RoomMood {
  readonly root = new Group();
  private veil: Mesh;
  private ripples: Mesh;
  private dusk = 0;
  private sea = 0;
  private wantDusk = 0;
  private wantSea = 0;
  private t = 0;
  enabled = true;
  /** World positions of the palms (Night's lanterns) and how lit each is (0..1). */
  readonly lamps = [new Vector3(), new Vector3()];
  readonly lampOn = [0, 0];
  /** Night: a tracked palm opens the dusk around it. */
  setLamp(i: 0 | 1, pos: Vector3 | null, dt: number): void {
    const want = pos && this.dusk > 0.05 ? 1 : 0;
    if (pos) this.lamps[i].copy(pos);
    this.lampOn[i] += (want - this.lampOn[i]) * Math.min(1, dt * 6);
  }

  constructor() {
    this.root.name = 'RoomMood';
    // a big sphere around the seat, seen from inside: drawn behind everything nearer (the loom, the hands' toys)
    this.veil = new Mesh(new SphereGeometry(2.6, 24, 16), new MeshBasicMaterial({ color: 0x0b1633, side: BackSide, transparent: true, opacity: 0, depthWrite: false }));
    this.veil.name = 'NightVeil';
    this.veil.position.set(0, 0.35, 0.4);
    this.veil.visible = false;
    this.veil.renderOrder = -5;
    // Night: your palm is a lantern. Wherever your real hand is in view, the dusk opens in a soft warm pool
    // (by angle from the eyes: the veil is far away, the hand near)
    const vm = this.veil.material as MeshBasicMaterial;
    vm.onBeforeCompile = (sh) => {
      sh.uniforms.uLamp = { value: this.lamps };
      sh.uniforms.uLampOn = { value: this.lampOn };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nuniform vec3 uLamp[2];\nuniform float uLampOn[2];')
        .replace(
          '#include <dithering_fragment>',
          `vec3 vd = normalize(vWorldPos - cameraPosition);
          float open = 0.0;
          for (int i = 0; i < 2; i++) {
            vec3 ld = uLamp[i] - cameraPosition;
            float dist = max(length(ld), 0.05);
            float a = acos(clamp(dot(vd, ld / dist), -1.0, 1.0));
            float r = atan(0.17 / dist); // a pool about 17 cm across around the palm
            open = max(open, uLampOn[i] * (1.0 - smoothstep(r * 0.45, r, a)));
          }
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.36, 0.12), open * 0.6); // a warm rim
          gl_FragColor.a *= 1.0 - open * 0.92;
          #include <dithering_fragment>`,
        );
    };
    // ripples of light on the table: a caustic pattern drifting under a soft round fade
    const map = causticTexture();
    map.wrapS = map.wrapT = RepeatWrapping;
    map.repeat.set(4, 2.7);
    this.ripples = new Mesh(
      new PlaneGeometry(1.1, 0.75),
      // cyan lines on a clear ground (normal blending): they read on a dark table and a pale one alike
      new MeshBasicMaterial({ map, alphaMap: fadeTexture(), color: 0x7fd0ff, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ripples.name = 'SeaRipples';
    this.ripples.rotation.x = -Math.PI / 2;
    this.ripples.position.set(0, 0.0012, 0.05);
    this.ripples.visible = false;
    this.root.add(this.veil, this.ripples);
  }

  /** The chapter on the loom. */
  set(chapter: string | undefined): void {
    this.wantDusk = chapter === 'night' ? 1 : 0;
    this.wantSea = chapter === 'sea' ? 1 : 0;
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 0.8); // a slow change, like the light outside
    const on = this.enabled ? 1 : 0;
    this.dusk += (this.wantDusk * on - this.dusk) * k;
    this.sea += (this.wantSea * on - this.sea) * k;
    (this.veil.material as MeshBasicMaterial).opacity = 0.42 * this.dusk;
    this.veil.visible = this.dusk > 0.01;
    const rm = this.ripples.material as MeshBasicMaterial;
    rm.opacity = 0.32 * this.sea;
    this.ripples.visible = this.sea > 0.01;
    if (this.ripples.visible && rm.map) {
      this.t += dt * (motion.calm ? 0.15 : 1); // calm motion: the light barely drifts
      rm.map.offset.set(Math.sin(this.t * 0.11) * 0.3 + this.t * 0.012, Math.cos(this.t * 0.09) * 0.2);
      rm.map.rotation = Math.sin(this.t * 0.05) * 0.2;
    }
  }
}

/**
 * Water caustics (tileable): the bright, curved edges of a cell network, as
 * light makes on the bottom of a pool. Edge brightness comes from how close a
 * pixel is to its two nearest points (Worley F2 − F1), drawn once.
 */
function causticTexture(): CanvasTexture {
  const S = 192;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let seed = 4;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts: [number, number][] = [];
  for (let i = 0; i < 18; i++) pts.push([rnd() * S, rnd() * S]);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (const [px, py] of pts) {
        // wrap-around distance: the pattern tiles
        const dx = Math.min(Math.abs(x - px), S - Math.abs(x - px));
        const dy = Math.min(Math.abs(y - py), S - Math.abs(y - py));
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      const edge = Math.max(0, 1 - (d2 - d1) / 7); // bright near cell edges
      const a = Math.round(255 * Math.pow(edge, 1.6));
      const o = (y * S + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}

/** A soft round fade (alpha map): the ripples melt into the table at their edges. */
function fadeTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  r.addColorStop(0, '#fff');
  r.addColorStop(0.65, '#888');
  r.addColorStop(1, '#000');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
