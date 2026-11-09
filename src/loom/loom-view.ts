/**
 * Procedural loom visuals. Pure Three.js (imported via @iwsdk/core).
 * Draw-call budget: frame (1 merged-ish group of 5), warps (1 instanced),
 * cloth (1 instanced), levers (4 knobs + 1 instanced track), shuttle (1),
 * shadow (1), glow (2).
 */
import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  AdditiveBlending,
  CylinderGeometry,
  Object3D,
} from '@iwsdk/core';
import { TargetCard } from '../ui/target-card.js';
import { THEMES, type Palette, type Theme } from '../ui/theme.js';
import {
  BOBBIN,
  CARD,
  LEVER,
  LEVERS,
  bobbinX,
  LOOM,
  SHUTTLE,
  TOKEN,
  tokenX,
  WARPS,
  WARP_PITCH,
  leverX,
  warpX,
} from '../config.js';
import { isLifted, type Mask8 } from '../puzzle/tieup.js';

export type { Palette };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);
const _glow = new Color(0xffe2a8);

export class LoomView {
  readonly root = new Group();
  /** Theme-dependent meshes live here so a theme switch can rebuild them. */
  private body = new Group();
  levers: Mesh[] = [];
  shuttle!: Mesh;
  readonly glows: Record<'left' | 'right', Mesh>;
  private warps!: InstancedMesh;
  private cloth!: InstancedMesh;
  private tracks!: InstancedMesh;
  private leverMats: MeshStandardMaterial[] = [];
  private shuttleMat!: MeshStandardMaterial;
  bobbin!: Mesh;
  readonly card: TargetCard;
  /** Style token: poke or pinch to switch theme. */
  readonly token: Group;
  private preview!: InstancedMesh;
  palette!: Palette;
  theme!: Theme;
  private activeLevers: number = LEVERS;
  private rowsCache: readonly Mask8[] = [];
  private glowRow = -1;
  private warpLift = new Float32Array(WARPS); // animated 0..1
  private side: 1 | -1 = 1;
  private pulse = 0;

  constructor(theme: Theme = THEMES.toy) {
    this.root.name = 'Loom';
    this.root.add(this.body);
    this.card = new TargetCard(theme);
    this.root.add(this.card.mesh);
    this.token = makeToken();
    this.root.add(this.token);

    // Pinch glows (world-space; positioned by the game system).
    const glowMat = new MeshBasicMaterial({
      color: 0xffe2a8,
      transparent: true,
      opacity: 0.0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const glowGeo = new SphereGeometry(0.006, 12, 8);
    this.glows = { left: new Mesh(glowGeo, glowMat), right: new Mesh(glowGeo, glowMat.clone()) };

    this.build(theme);
    this.setSide(1);
    this.setShed(0, true);
    this.setShuttleT(0);
  }

  /** Swap the visual theme; gameplay state is re-applied by the caller's next sync. */
  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    disposeTree(this.body);
    this.body.clear();
    this.levers = [];
    this.leverMats = [];
    this.build(theme);
    this.card.setTheme(theme);
    this.layoutLevers();
    this.setBobbinT(0);
    this.setShed(this.targetShed, true);
    this.setRows(this.rowsCache);
    this.placeCard();
  }

  private build(theme: Theme): void {
    this.theme = theme;
    const palette = (this.palette = theme.palette);
    const add = (...o: Object3D[]) => this.body.add(...o);
    const wood = new MeshStandardMaterial({ color: palette.wood, roughness: theme.woodRoughness });
    const rail = new MeshStandardMaterial({ color: palette.rail, roughness: theme.woodRoughness });

    // Frame: rounded capsules (toy) or squared timber (workshop).
    const w = LOOM.frameHalfWidth * 2;
    const len = LOOM.frontBeamZ - LOOM.backBeamZ;
    const round = theme.beam === 'round';
    const beamGeo = round ? new CapsuleGeometry(0.009, w, 6, 16) : new BoxGeometry(w + 0.03, 0.016, 0.016);
    const back = new Mesh(beamGeo, wood);
    const front = new Mesh(beamGeo, wood);
    if (round) back.rotation.z = front.rotation.z = Math.PI / 2;
    back.position.set(0, LOOM.beamY, LOOM.backBeamZ);
    front.position.set(0, LOOM.beamY - 0.004, LOOM.frontBeamZ);
    const railGeo = round ? new CapsuleGeometry(0.007, len, 6, 12) : new BoxGeometry(0.012, 0.012, len + 0.02);
    const railL = new Mesh(railGeo, rail);
    if (round) railL.rotation.x = Math.PI / 2;
    railL.position.set(-LOOM.frameHalfWidth - 0.012, 0.007, (LOOM.frontBeamZ + LOOM.backBeamZ) / 2);
    const railR = railL.clone();
    railR.position.x = -railL.position.x;
    const heddleGeo = round ? new CapsuleGeometry(0.0025, w, 4, 8) : new BoxGeometry(w, 0.004, 0.004);
    const heddle = new Mesh(heddleGeo, rail);
    if (round) heddle.rotation.z = Math.PI / 2;
    heddle.position.set(0, LOOM.liftedY + 0.006, LOOM.heddleZ);
    add(back, front, railL, railR, heddle);

    // Warps: 2 segments each (back beam → heddle → fell).
    const warpMat = new MeshStandardMaterial({ color: palette.warp, roughness: 0.9 });
    this.warps = new InstancedMesh(new BoxGeometry(0.003, 0.003, 1), warpMat, WARPS * 2);
    this.warps.name = 'Warps';
    add(this.warps);

    // Cloth cells.
    const cellGeo = new BoxGeometry(WARP_PITCH * 0.92, 0.0025, LOOM.rowPitch * 0.9);
    const clothMat = new MeshStandardMaterial({ roughness: 0.95 });
    this.cloth = new InstancedMesh(cellGeo, clothMat, WARPS * LOOM.visibleRows);
    this.cloth.name = 'Cloth';
    this.cloth.count = 0;
    add(this.cloth);

    // Lever tracks + knobs.
    const trackMat = new MeshStandardMaterial({ color: theme.track, roughness: 1 });
    this.tracks = new InstancedMesh(
      new BoxGeometry(0.008, 0.004, LEVER.travel + 0.024),
      trackMat,
      LEVERS,
    );
    add(this.tracks);
    const knobGeo = new SphereGeometry(LEVER.knobRadius, 24, 16);
    for (let k = 0; k < LEVERS; k++) {
      const mat = new MeshStandardMaterial({
        color: palette.knobs[k],
        roughness: theme.knobRoughness,
        metalness: theme.knobMetalness,
      });
      this.leverMats.push(mat);
      const knob = new Mesh(knobGeo, mat);
      knob.name = `Lever${k}`;
      this.levers.push(knob);
      add(knob);
    }

    // Shuttle: a capsule lying along X.
    this.shuttleMat = new MeshStandardMaterial({ color: palette.shuttle, roughness: 0.55 });
    this.shuttle = new Mesh(new CapsuleGeometry(0.0085, 0.04, 8, 16), this.shuttleMat);
    this.shuttle.rotation.z = Math.PI / 2;
    this.shuttle.name = 'Shuttle';
    add(this.shuttle);

    // Live preview of the next row (ghost cells at the fell).
    this.preview = new InstancedMesh(
      cellGeo,
      new MeshStandardMaterial({ transparent: true, opacity: 0.45, roughness: 1, depthWrite: false }),
      WARPS,
    );
    this.preview.name = 'PreviewRow';
    add(this.preview);

    // Undo bobbin: a small spool lying along X.
    const bobGeo = new CapsuleGeometry(BOBBIN.radius, 0.014, 4, 12);
    this.bobbin = new Mesh(bobGeo, new MeshStandardMaterial({ color: palette.weft, roughness: 0.8 }));
    this.bobbin.rotation.z = Math.PI / 2;
    this.bobbin.name = 'Bobbin';
    add(this.bobbin);

    // Contact shadow decal.
    const shadow = new Mesh(
      new PlaneGeometry(0.42, 0.3),
      new MeshBasicMaterial({
        map: radialTexture(),
        transparent: true,
        depthWrite: false,
        color: 0x000000,
        opacity: 0.45,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.04, 0.0005, 0);
    shadow.renderOrder = -1;
    add(shadow);
    for (let k = 0; k < LEVERS; k++) this.setLeverT(k, 0);
  }

  setSide(side: 1 | -1): void {
    this.side = side;
    this.token.position.set(tokenX(side), TOKEN.y, TOKEN.z);
    this.layoutLevers();
    this.setBobbinT(0);
    this.placeCard();
  }

  /** Show only the levers this level uses. */
  setActiveLevers(n: number): void {
    this.activeLevers = n;
    this.layoutLevers();
  }

  private layoutLevers(): void {
    const zc = LEVER.restZ - LEVER.travel / 2;
    for (let k = 0; k < LEVERS; k++) {
      const on = k < this.activeLevers;
      _p.set(leverX(k, this.side), 0.002, zc);
      _m.compose(_p, _q.identity(), _s.setScalar(on ? 1 : 0));
      this.tracks.setMatrixAt(k, _m);
      this.levers[k].visible = on;
    }
    this.tracks.instanceMatrix.needsUpdate = true;
  }

  setBobbinT(t: number): void {
    this.bobbin.position.set(bobbinX(this.side), BOBBIN.y, BOBBIN.z + BOBBIN.pull * t);
    this.bobbin.rotation.x = t * Math.PI * 3; // unspools as you pull
  }

  setTokenHighlight(level: 0 | 1 | 2): void {
    const s = level === 2 ? 1.25 : level === 1 ? 1.12 : 1;
    this.token.scale.setScalar(s);
  }

  setBobbinHighlight(level: 0 | 1 | 2): void {
    const m = this.bobbin.material as MeshStandardMaterial;
    m.emissive.copy(m.color).multiplyScalar(level === 2 ? 0.45 : level === 1 ? 0.22 : 0);
  }

  /** Redraw the card, then stand it at the back corner opposite the bank. */
  placeCard(): void {
    const m = this.card.mesh;
    const tilt = (CARD.tiltDeg * Math.PI) / 180;
    const h = this.card.heightM;
    m.position.set(-this.side * CARD.x, 0.004 + (h / 2) * Math.cos(tilt), CARD.z - (h / 2) * Math.sin(tilt));
    m.rotation.set(-tilt, 0, 0);
  }

  /** Ghost cells for the row the next pass would weave. */
  setPreview(mask: Mask8, visible: boolean): void {
    this.preview.visible = visible;
    if (!visible) return;
    const z = LOOM.fellZ - LOOM.rowPitch * 0.6;
    for (let i = 0; i < WARPS; i++) {
      _p.set(warpX(i), 0.0065, z);
      _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
      this.preview.setMatrixAt(i, _m);
      _c.setHex(isLifted(mask, i) ? this.palette.warp : this.palette.weft);
      this.preview.setColorAt(i, _c);
    }
    this.preview.instanceMatrix.needsUpdate = true;
    if (this.preview.instanceColor) this.preview.instanceColor.needsUpdate = true;
  }

  /** Highlight one woven row (playback), -1 for none. */
  setGlowRow(r: number): void {
    if (r === this.glowRow) return;
    this.glowRow = r;
    this.setRows(this.rowsCache);
  }

  /** Lever k at t ∈ [0,1] (0 = rest, 1 = latched/away). */
  setLeverT(k: number, t: number): void {
    const knob = this.levers[k];
    knob.position.set(leverX(k, this.side), LEVER.knobY, LEVER.restZ - LEVER.travel * t);
  }

  setLeverHighlight(k: number, level: 0 | 1 | 2, latched: boolean): void {
    const mat = this.leverMats[k];
    const e = level === 2 ? 0.45 : level === 1 ? 0.22 : latched ? 0.1 : 0;
    mat.emissive.copy(mat.color).multiplyScalar(e);
  }

  setShuttleT(t: number): void {
    this.shuttle.position.set(
      SHUTTLE.minX + (SHUTTLE.maxX - SHUTTLE.minX) * t,
      SHUTTLE.y,
      SHUTTLE.z,
    );
  }

  setShuttleHighlight(level: 0 | 1 | 2): void {
    this.shuttleMat.emissive.copy(this.shuttleMat.color).multiplyScalar(level === 2 ? 0.6 : level === 1 ? 0.3 : 0);
  }

  /** Set the target shed; `immediate` skips the lift animation. */
  setShed(mask: Mask8, immediate = false): void {
    this.targetShed = mask;
    if (immediate) {
      for (let i = 0; i < WARPS; i++) this.warpLift[i] = isLifted(mask, i) ? 1 : 0;
      this.writeWarps();
    }
  }
  private targetShed: Mask8 = 0;

  /** Rows, oldest first; only the last `visibleRows` are drawn. */
  setRows(rows: readonly Mask8[]): void {
    this.rowsCache = rows;
    const n = Math.min(rows.length, LOOM.visibleRows);
    const start = rows.length - n;
    let idx = 0;
    for (let r = 0; r < n; r++) {
      const row = rows[start + r];
      // newest row sits at the fell; older rows move toward the user.
      const z = LOOM.fellZ + (n - 1 - r) * LOOM.rowPitch + LOOM.rowPitch / 2;
      for (let i = 0; i < WARPS; i++) {
        _p.set(warpX(i), 0.006, z);
        _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
        this.cloth.setMatrixAt(idx, _m);
        // warp visible if lifted in that row, else weft visible
        _c.setHex(isLifted(row, i) ? this.palette.warp : this.palette.weft);
        if (start + r === this.glowRow) _c.lerp(_glow, 0.55);
        this.cloth.setColorAt(idx, _c);
        idx++;
      }
    }
    this.cloth.count = idx;
    this.cloth.instanceMatrix.needsUpdate = true;
    if (this.cloth.instanceColor) this.cloth.instanceColor.needsUpdate = true;
  }

  /** Brief visual twin for every sound (deaf/HoH accessibility). */
  pulseWarp(): void {
    this.pulse = 1;
  }

  update(dt: number): void {
    let dirty = false;
    const k = Math.min(1, dt * 14);
    for (let i = 0; i < WARPS; i++) {
      const target = isLifted(this.targetShed, i) ? 1 : 0;
      const d = target - this.warpLift[i];
      if (Math.abs(d) > 1e-4) {
        this.warpLift[i] += d * k;
        dirty = true;
      }
    }
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 4);
      (this.warps.material as MeshStandardMaterial).emissive.setScalar(this.pulse * 0.25);
    }
    if (dirty) this.writeWarps();
  }

  private writeWarps(): void {
    const fellY = 0.006;
    for (let i = 0; i < WARPS; i++) {
      const x = warpX(i);
      const hy = LOOM.loweredY + (LOOM.liftedY - LOOM.loweredY) * this.warpLift[i];
      this.segment(i * 2, x, LOOM.beamY + 0.007, LOOM.backBeamZ, hy, LOOM.heddleZ);
      this.segment(i * 2 + 1, x, hy, LOOM.heddleZ, fellY, LOOM.fellZ);
    }
    this.warps.instanceMatrix.needsUpdate = true;
  }

  /** Instance `idx` as a unit-Z box stretched from (x,y0,z0) to (x,y1,z1). */
  private segment(idx: number, x: number, y0: number, z0: number, y1: number, z1: number) {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    _p.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
    _q.setFromAxisAngle(_s.set(1, 0, 0), -Math.atan2(dy, dz));
    _m.compose(_p, _q, _s.set(1, 1, len));
    this.warps.setMatrixAt(idx, _m);
  }
}

/** Style token: a flat disc, half toy-painted, half oiled oak. */
function makeToken(): Group {
  const g = new Group();
  g.name = 'StyleToken';
  const half = (color: number, start: number, rough: number, metal = 0) => {
    const m = new Mesh(
      new CylinderGeometry(TOKEN.radius, TOKEN.radius, 0.006, 24, 1, false, start, Math.PI),
      new MeshStandardMaterial({ color, roughness: rough, metalness: metal }),
    );
    g.add(m);
  };
  half(0xe2563b, 0, 0.6); // toy tomato
  half(0xb07a4f, Math.PI, 0.5); // workshop oak
  const rim = new Mesh(
    new CylinderGeometry(TOKEN.radius * 0.35, TOKEN.radius * 0.35, 0.0075, 16),
    new MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.35, metalness: 0.7 }),
  );
  g.add(rim);
  return g;
}

function disposeTree(o: Object3D): void {
  o.traverse((n) => {
    const m = n as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}

function radialTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  return t;
}

export { UP };
