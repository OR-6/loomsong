/**
 * Procedural loom visuals. Pure Three.js (imported via @iwsdk/core).
 * Draw-call budget: frame (1 merged-ish group of 5), warps (1 instanced),
 * cloth (1 instanced), levers (4 knobs + 1 instanced track), shuttle (1),
 * shadow (1), glow (2).
 */
import {
  BoxGeometry,
  CanvasTexture,
  SRGBColorSpace,
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
  TorusGeometry,
  ConeGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Object3D,
  DirectionalLight,
  ShadowMaterial,
  MeshPhysicalMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  BackSide,
  type Material,
} from '@iwsdk/core';
import { TargetCard } from '../ui/target-card.js';
import { THEMES, type Palette, type Theme } from '../ui/theme.js';
import { PLAQUE, Plaque } from '../ui/plaque.js';
import { feltTexture, grainTexture, weaveTexture, yarnTexture } from './textures.js';
import { cloneModel, loomModels, materialOf, mergeStatic } from './models.js';
import { PLUSH, Plushes, puffGeometry } from './plush.js';
import { DAILY_BALL } from './daily-ball.js';
import { Basket } from './basket.js';
import { DailyBall } from './daily-ball.js';
import { GhostHand } from './ghost-hand.js';
import { Fx } from './fx.js';
import { makeMat, MAT } from './mat.js';
import {
  BOBBIN,
  CARD,
  LEVER,
  BASKET,
  LEVERS,
  bobbinX,
  LOOM,
  SHUTTLE,
  TOKEN,
  tokenX,
  NUDGE,
  nudgeX,
  WARPS,
  WARP_PITCH,
  leverX,
  warpX,
  shuttleY,
} from '../config.js';
import { WEFT_B, isLifted, type Mask8 } from '../puzzle/tieup.js';

export type { Palette };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const _c2 = new Color();
const UP = new Vector3(0, 1, 0);
const _glow = new Color(0xffe2a8);
const _white = new Color(0xffffff);
/** Seconds the newest row animates (beat-in, flash or shake). */
const ROW_FX = 0.45;
/** Opacity of the ghost picture on the rows still to weave. */
const GHOST_OPACITY = 0.92;
/** Sea's swap spools: on short walnut pegs just in front of each perch (Pip's yarn supply). */
export const SWAP = { x: 0.172, y: 0.036, z: 0.036 } as const;
const backOut = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
/** Underside of the heddle bar in the Blender model (bar centre 0.071, 17 mm tall). */
const HEDDLE_BAR_BOTTOM_Y = 0.0625;
/** Lowered warp threads: warm undyed yarn, not white (white reads as plastic). */
const THREAD_CREAM = 0xe2cca0;
/** The style token is drawn 1.6x (it read as a stray bead at 2 cm). */
export const TOKEN_SIZE = 1.6;
/** The undo spool's yarn: red, so it reads as a control, not debris. */
const UNDO_RED = 0xe4573d;

/** Undyed wool: the colour of a mystery lever before it's been tried. */
const UNDYED = 0xcdbb98; // oatmeal: clearly not the cream stems
/** Strands per warp bundle, and their spread (they pinch to 30 % at the eyelet). */
const STRANDS = 1;
const STRAND_GAP = 0.0052;
const _a = new Vector3();
const _b = new Vector3();
const Z_AXIS = new Vector3(0, 0, 1);

export class LoomView {
  readonly root = new Group();
  /** Theme-dependent meshes live here so a theme switch can rebuild them. */
  private body = new Group();
  levers: Object3D[] = [];
  shuttle!: Object3D;
  /** Pip parts animated in update(). */
  private pipWings: Object3D[] = [];
  /** Pip's model inside the shuttle group: moods move this, facing turns the group. */
  private pipInner: Object3D | null = null;
  /** The boat shuttle under Pip (highlights with Pip) and the weft bobbin in it. */
  private boatMat: MeshStandardMaterial | null = null;
  private boatYarn: MeshStandardMaterial | null = null;
  private pipBall = new MeshStandardMaterial({ color: 0xf3e6cc, roughness: 0.9 });
  private weftColor: number | null = null;
  private weftNow: 0 | 1 = 0;
  /** Sea: a little yarn spool on a peg beside each perch; touch one to swap Pip's yarn. */
  readonly weftSpools = new Group();
  private swapYarnMat = new MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.85 });
  private mood: 'none' | 'happy' | 'sad' | 'cheer' = 'none';
  private moodT = 0;
  private idleIn = 3;
  private idleKind = 0;
  private pipEyes: Object3D[] = [];
  private pipFacing = 1;
  private blinkIn = 2.5;
  private frameNode: Object3D | null = null;
  readonly glows: Record<'left' | 'right', Mesh>;
  private warps!: InstancedMesh;
  private cords!: InstancedMesh;
  private eyes!: InstancedMesh;
  /** Coloured ties: one bead per (lever, thread it lifts), in the lever's colour. */
  /** Knots per lever shape (round, square, triangle, ring), matching the knob caps. */
  private ties: InstancedMesh[] = [];
  private tieUp: readonly Mask8[] = [];
  /** Where the next row will be laid (moves back toward the heddle as cloth grows). */
  private fellZ: number = LOOM.fellZ;
  private tieHidden: boolean[] = [];
  private hoverLever = -1;
  /** Picture colour (lifted threads) and ground (cream weft). */
  private liftColor = 0;
  private groundColor = 0;
  private liftWoven = 0;
  private pictureColor: number | null = null;
  private cloth!: InstancedMesh;
  private ghostCloth: InstancedMesh | null = null;
  private rowArrow = new Mesh();
  private rowArrowMat = new MeshBasicMaterial({ color: 0x2b2b2b, side: DoubleSide });
  private tracks: InstancedMesh | null = null;
  private leverMats: MeshStandardMaterial[] = [];
  /** Yarn wraps on the knob stems (model only), recoloured with the caps. */
  private wrapMats: (MeshStandardMaterial | null)[] = [];
  /** Reveal bounce per lever (1 → 0) when a mystery lever is first tried. */
  private revealPop = new Float32Array(LEVERS);
  /** Knob juice springs (cap width/height and their velocities) and touch level. */
  private knobW = new Float32Array(LEVERS).fill(1);
  private knobH = new Float32Array(LEVERS).fill(1);
  private knobVW = new Float32Array(LEVERS);
  private knobVH = new Float32Array(LEVERS);
  private knobLevel = new Uint8Array(LEVERS);
  /** Newest-row animation clock (-1: idle) and verdict. */
  private rowFxT = -1;
  /** Pip pick-up squash clock (-1: idle), flight lean, and trail distance. */
  private pipGrabT = -1;
  /** Shuttle glide after a jump (-1: none). */
  private glideT = -1;
  private glideFrom = 0;
  /** New-picture arrival clock (-1: idle). */
  private arriveT = -1;
  private pipLean = 0;
  private trailDist = 0;
  private rowFxGood = true;
  /** Undo spool nudge after a wrong row (1 → 0), its wiggle angle and glow. */
  private undoNudge = 0;
  private undoWiggle = 0;
  private undoGlow = 0;
  private bobbinGlowShown = -1;
  /** Tutorial/idle hint breathing on the undo spool (0–1). */
  undoHint = 0;
  private knobCaps: (Object3D | null)[] = [];
  private shuttleMat!: MeshStandardMaterial;
  bobbin!: Object3D;
  readonly card: TargetCard;
  /** Style token: poke or pinch to switch theme. */
  readonly token: Group;
  /** Front-beam nameplate: level number and star total. */
  readonly plaque = new Plaque();
  /** Desk-height nudge arrows (shown for default placement only). */
  readonly nudges: Group = makeNudges();
  private preview!: InstancedMesh;
  palette!: Palette;
  theme!: Theme;
  private activeLevers: number = LEVERS;
  private rowsCache: readonly Mask8[] = [];
  private glowRow = -1;
  private warpLift = new Float32Array(WARPS); // animated 0..1 (springy, can overshoot)
  private warpVel = new Float32Array(WARPS);
  /** Per-warp twang amplitude (pluck visual twin). */
  private twang = new Float32Array(WARPS);
  private clock = 0;
  /** Lever spring state (visual only; logic lives in the controller). */
  private leverX = new Float32Array(LEVERS);
  private leverV = new Float32Array(LEVERS);
  private leverTarget = new Float32Array(LEVERS);
  private leverHeld = new Uint8Array(LEVERS);
  private shuttleT = 0;
  private shuttleVel = 0;
  private squash = 0;
  private shadowOn = true;

  /**
   * Real-time shadows on/off (frame guard, `?shadows=0`). The soft contact
   * shadows under every object stay: they ground the toys on the real desk
   * at almost no cost.
   */
  setShadow(on: boolean): void {
    this.shadowOn = on;
    this.key.castShadow = on;
    this.catcher.visible = on;
  }
  /** The lever box's dots: 1–4 in front of each slot that has a lever this picture (empty slots stay plain). */
  private layoutPips(): void {
    const pips = this.slotPips;
    if (!pips) return;
    let n = 0;
    const m = new Matrix4();
    const levers = this.tieUp?.length ?? LEVERS;
    for (let k = 0; k < Math.min(LEVERS, levers); k++) {
      for (let j = 0; j <= k; j++) {
        m.makeTranslation(leverX(k, this.side) + (j - k / 2) * 0.0068, 0.0295, 0.0915);
        pips.setMatrixAt(n++, m);
      }
    }
    pips.count = n;
    pips.instanceMatrix.needsUpdate = true;
  }

  /** Soft contact shadows under the shelf, the lever box, the basket and the gift (follow the lever side). */
  private blobs: Mesh[] = [];
  /**
   * 1–4 cream dots inlaid in the lever box's top, in front of each slot: levers
   * are told apart by count as well as colour (colour-blind players, Night's
   * undyed mystery knobs). One instanced draw.
   */
  private slotPips: InstancedMesh | null = null;
  /** Warm key light (moves with the loom) and a desk shadow catcher. */
  private key = new DirectionalLight(0xfff0dc, 1.6);
  /** Felt mat under everything; the chapter shelf and plush show. */
  readonly mat = makeMat();
  readonly plushes = new Plushes();
  readonly basket = new Basket();
  readonly daily = new DailyBall();
  readonly ghost = new GhostHand();
  readonly fx = new Fx();

  /** Placement reveal 0→1: the mat unrolls toward the player. */
  setReveal(t: number): void {
    this.mat.scale.z = Math.max(0.001, Math.min(1, t));
  }
  private catcher = new Mesh(new PlaneGeometry(0.8, 0.6), new ShadowMaterial({ opacity: 0.34, depthWrite: false }));
  private side: 1 | -1 = 1;
  private pulse = 0;

  constructor(theme: Theme = THEMES.toy) {
    this.root.name = 'Loom';
    this.root.add(this.body);
    this.card = new TargetCard(theme);
    this.root.add(this.card.mesh);
    this.token = makeToken();
    this.token.scale.setScalar(TOKEN_SIZE); // big enough to read as a control, not a stray bead
    this.root.add(this.token);
    this.root.add(this.plaque.mesh);
    this.root.add(this.nudges);
    this.nudges.visible = false;
    this.plaque.setTheme(theme);

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

    // Key light from front-left and above, soft shadow onto the real desk.
    this.key.name = 'KeyLight';
    this.key.position.set(-0.34, 0.36, 0.26);
    this.key.target.position.set(0, 0, -0.02);
    this.key.castShadow = true;
    const sh = this.key.shadow;
    sh.mapSize.set(1024, 1024);
    sh.camera.left = -0.32;
    sh.camera.right = 0.32;
    sh.camera.top = 0.32;
    sh.camera.bottom = -0.32;
    sh.camera.near = 0.05;
    sh.camera.far = 1.4;
    sh.bias = -0.0004;
    sh.normalBias = 0.0015;
    sh.radius = 3;
    this.root.add(this.key, this.key.target);
    // Cool rim light from behind: separates the toy from a busy real room.
    const rim = new DirectionalLight(0xdfe8ff, 0.5);
    rim.name = 'RimLight';
    rim.position.set(0.25, 0.3, -0.45);
    rim.target.position.set(0, 0, 0);
    this.root.add(rim, rim.target);
    this.catcher.name = 'ShadowCatcher';
    this.catcher.rotation.x = -Math.PI / 2;
    this.catcher.position.set(0.03, 0.0003, -0.01);
    this.catcher.receiveShadow = true;
    this.catcher.renderOrder = -1;
    this.root.add(this.catcher);
    // No mat: the player's real desk shows around the toy (it's mixed reality).
    this.root.add(this.plushes.root, this.basket.root, this.daily.root, this.ghost.root, this.fx.root);
    // Sea's swap spools (hidden unless the level has a second weft)
    {
      const flangeMat = new MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.7 });
      const pegMat = new MeshStandardMaterial({ color: 0x6b3e26, roughness: 0.6 });
      this.swapYarnMat.map = yarnTexture();
      // one spool, in front of the perch on the lever side (the undo spool owns the other side)
      const sp = new Group();
      sp.name = 'SwapSpool';
      const yarn = new Mesh(new CylinderGeometry(0.016, 0.016, 0.024, 24), this.swapYarnMat);
      const f1 = new Mesh(new CylinderGeometry(0.0205, 0.0205, 0.004, 24), flangeMat);
      f1.position.y = 0.0135;
      const f2 = f1.clone();
      f2.position.y = -0.0135;
      const peg = new Mesh(new CylinderGeometry(0.0024, 0.003, SWAP.y, 10), pegMat);
      peg.position.y = -SWAP.y / 2;
      sp.add(yarn, f1, f2, peg);
      sp.position.set(SWAP.x, SWAP.y, SWAP.z);
      this.weftSpools.add(sp);
      this.weftSpools.visible = false;
      this.root.add(this.weftSpools);
    }

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
    this.wrapMats = [];
    this.build(theme);
    for (let k = 0; k < LEVERS; k++) this.dyeLever(k);
    this.card.setTheme(theme);
    this.plaque.setTheme(theme);
    this.layoutLevers();
    for (let k = 0; k < LEVERS; k++) this.placeKnob(k);
    this.setBobbinT(0);
    this.setShed(this.targetShed, true);
    this.setRows(this.rowsCache);
    this.placeCard();
  }

  private build(theme: Theme): void {
    this.theme = theme;
    const palette = (this.palette = theme.palette);
    const add = (...o: Object3D[]) => this.body.add(...o);
    const grain = grainTexture();
    const wood = new MeshStandardMaterial({ color: palette.wood, roughness: theme.woodRoughness, map: grain });
    const rail = new MeshStandardMaterial({ color: palette.rail, roughness: theme.woodRoughness, map: grain });

    const models = loomModels();
    // Wood tint per theme: natural beech (toy) or honey oak (workshop).
    // The rim paint ('Beech' in the model) stays sunny yellow in the toy theme;
    // the workshop theme repaints it honey oak.
    const tint = (m: Material, name: string) => {
      const sm = m as MeshStandardMaterial;
      if (name === 'Beech' && theme.id === 'workshop') sm.color.setHex(0xc9905e);
      // painted wood is matte: no plastic-pipe highlight on the frame (brass and the like keep their shine)
      if (theme.id === 'toy' && sm.isMeshStandardMaterial && sm.metalness < 0.3) sm.roughness = Math.max(sm.roughness, 0.86);
      // the toy loom's frame is painted mustard (art direction): a made toy, not bare plastic-looking pipe
      if (theme.id === 'toy' && name === 'Beech') sm.color.setHex(0xe8ac3e);
    };
    this.frameNode = null;
    if (models) {
      this.frameNode = cloneModel(models.frame, tint);
      // Felt reads as felt with a soft fuzzy sheen at grazing angles.
      const bed = this.frameNode.getObjectByName('Bed') as Mesh | undefined;
      if (bed) {
        const src = bed.material as MeshStandardMaterial;
        bed.material = new MeshPhysicalMaterial({ color: src.color, roughness: 0.9, sheen: 1, sheenRoughness: 0.75, sheenColor: new Color(0x8fb0dd) });
        src.dispose();
      }
      // draw-call diet: fold the frame's static parts into one mesh per material
      // (parts the game mirrors, recolours or hides by name stay separate)
      mergeStatic(this.frameNode, (o) => o !== this.frameNode && /^(Lever|SlotFloor|SlotDot|SlotArrow|FrontBeamCrank|FrontBeamHandle|BobbinRod|Bed$|ContactShadow)/.test(o.name));
      add(this.frameNode);
    } else this.buildProceduralFrame(theme, wood, rail, add);


    // Warps: 2 segments each (back beam → heddle → fell).
    const warpMat = new MeshStandardMaterial({ color: palette.warp, roughness: 1, map: yarnTexture() });
    // Round twisted yarn: a cylinder along Z, stretched per segment.
    // Each logical warp is a bundle of STRANDS strands that gather through its eyelet.
    const warpGeo = new CylinderGeometry(0.0031, 0.0031, 1, 12, 1, true);
    warpGeo.rotateX(Math.PI / 2);
    // three segments per strand: back beam → heddle → fell → under the cloth to the front beam
    this.warps = new InstancedMesh(warpGeo, warpMat, WARPS * 3 * STRANDS);
    this.warps.name = 'Warps';
    add(this.warps);

    // Heddles: a cord per warp hanging from the heddle bar, with an eyelet the
    // warp threads through. Lifting a lever visibly pulls these up.
    const cordMat = new MeshStandardMaterial({ color: 0xeee2cc, roughness: 0.9 });
    this.cords = new InstancedMesh(new CylinderGeometry(0.0006, 0.0006, 1, 5, 1, true), cordMat, WARPS);
    this.cords.name = 'HeddleCords';
    this.eyes = new InstancedMesh(new TorusGeometry(0.0036, 0.0008, 6, 14), cordMat, WARPS);
    this.eyes.name = 'HeddleEyes';
    this.cords.frustumCulled = this.eyes.frustumCulled = false;
    this.cords.visible = this.eyes.visible = false; // chunky style: no fine heddle cords
    add(this.cords, this.eyes);
    this.applyColors();

    // Lever ties: little yarn knots on each warp, coloured like the lever
    // that lifts it, so cause and effect is visible before you pull.
    const tieGeos = [
      new SphereGeometry(0.0036, 12, 8),
      new BoxGeometry(0.0062, 0.0062, 0.0062),
      new ConeGeometry(0.0048, 0.0066, 3),
      new TorusGeometry(0.0033, 0.0013, 8, 16),
    ];
    tieGeos[2].rotateX(Math.PI); // triangle points down the thread, toward the cloth
    tieGeos[3].rotateY(Math.PI / 2); // ring threaded on the warp
    const tieMat = new MeshStandardMaterial({ roughness: 0.7 });
    this.ties = tieGeos.map((g, i) => {
      const m = new InstancedMesh(g, tieMat, WARPS);
      m.name = `LeverTies${i}`;
      m.visible = false; // chunky style: lever→thread shown by glow on touch, not knots
      m.frustumCulled = false;
      m.count = 0;
      add(m);
      return m;
    });

    // Cloth cells.
    const cellGeo = new BoxGeometry(WARP_PITCH * 0.995, 0.003, LOOM.rowPitch * 0.99);
    const clothMat = new MeshStandardMaterial({ roughness: 0.95, map: weaveTexture() }); // woven: weft fibres across each cell, not a knit stitch
    // Woven cells: flat, square yarn cells in one continuous band on the felt.
    this.cloth = new InstancedMesh(new BoxGeometry(1, 1, 1), clothMat, WARPS * LOOM.visibleRows);
    this.cloth.name = 'Cloth';
    // faint target picture on the rows still to weave
    this.ghostCloth = new InstancedMesh(
      cellGeo,
      new MeshBasicMaterial({ transparent: true, opacity: GHOST_OPACITY, depthWrite: false }), // unlit: reads clearly from the seat
      WARPS * LOOM.maxRows,
    );
    this.ghostCloth.name = 'TargetGhost';
    {
      const tri = (sc: number) => {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute([-0.007 * sc, 0, -0.0065 * sc, -0.007 * sc, 0, 0.0065 * sc, 0.007 * sc, 0, 0], 3));
        g.computeVertexNormals();
        return g;
      };
      this.rowArrow = new Mesh(tri(1), this.rowArrowMat);
      const rim = new Mesh(tri(1.35), new MeshBasicMaterial({ color: 0xfff1c2, side: DoubleSide }));
      rim.position.set(-0.0012, -0.0006, 0);
      this.rowArrow.add(rim);
      this.rowArrow.name = 'NextRowArrow';
      add(this.rowArrow);
    }
    this.ghostCloth.frustumCulled = false;
    this.ghostCloth.count = 0;
    add(this.ghostCloth);
    this.cloth.count = 0;
    add(this.cloth);
    // InstancedMesh caches its bounding sphere on first use; the cloth starts
    // empty (radius -1) and would be culled forever. These parts are tiny and
    // always in view, so skip culling for every instanced loom part.
    this.cloth.frustumCulled = false;
    this.warps.frustumCulled = false;

    // Lever knobs (turned wood stem + painted cap). Tracks only without models.
    this.tracks = null;
    if (!models) {
      const trackMat = new MeshStandardMaterial({ color: theme.track, roughness: 1 });
      this.tracks = new InstancedMesh(new BoxGeometry(0.008, 0.004, LEVER.travel + 0.024), trackMat, LEVERS);
      this.tracks.frustumCulled = false;
      add(this.tracks);
    }
    const knobGeo = new SphereGeometry(LEVER.knobRadius, 24, 16);
    for (let k = 0; k < LEVERS; k++) {
      if (models) {
        const knob = cloneModel(models.knob, tint);
        const cap = materialOf(knob, 'Cap0') as MeshStandardMaterial;
        this.knobCaps[k] = knob.getObjectByName('Cap0') ?? null;
        const c0 = this.knobCaps[k];
        if (c0) c0.userData.baseScale = c0.scale.toArray();
        cap.color.setHex(palette.knobs[k]);
        // yarn wrap on the stem, a shade deeper than the cap
        const wrap = materialOf(knob, 'StemWrap') as MeshStandardMaterial | null;
        this.wrapMats.push(wrap);
        if (wrap) {
          wrap.color.setHex(palette.knobs[k]).multiplyScalar(0.82);
          wrap.roughness = 0.95;
          wrap.metalness = 0;
          wrap.map = yarnTexture();
        }
        // matching dot at the latched end of this lever's slot
        const dot = this.frameNode?.getObjectByName(`SlotDot${k}`) as Mesh | undefined;
        (dot?.material as MeshStandardMaterial | undefined)?.color.setHex(palette.knobs[k]);
        cap.roughness = theme.knobRoughness;
        cap.metalness = theme.knobMetalness;
        if (theme.id === 'toy') cap.envMapIntensity = 0.25; // painted wood: no candy glint
        this.leverMats.push(cap);
        knob.name = `Lever${k}`;
        this.levers.push(knob);
        add(knob);
        continue;
      }
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
    this.pipWings = [];
    this.pipEyes = [];
    if (models?.pip) {
      // Pip, the shuttle songbird (faces its direction of travel).
      // Wrapped so squash-and-stretch scales around a slightly smaller Pip.
      const pip = cloneModel(models.pip);
      pip.scale.setScalar(0.95);
      this.boatYarn = materialOf(pip, 'BoatYarn') as MeshStandardMaterial | null;
      const boat = materialOf(pip, 'Boat') as MeshStandardMaterial | null;
      if (boat) this.boatMat = boat;
      this.shuttle = new Group();
      this.shuttle.add(pip);
      this.pipInner = pip;
      // Pip's yarn: a chunky ball in the stern of the boat, in the weft being woven
      this.pipBall.map = yarnTexture();
      const ball = new Mesh(new SphereGeometry(0.0085, 16, 12), this.pipBall);
      ball.name = 'PipYarnBall';
      ball.position.set(-0.024, 0.011, 0);
      ball.castShadow = true;
      pip.add(ball);
      this.shuttleMat = materialOf(this.shuttle, 'Body') as MeshStandardMaterial;
      // a felt bird, like the plushes: matte, with soft fibres (no rubber-duck shine)
      if (this.shuttleMat) {
        this.shuttleMat.roughness = 0.92;
        this.shuttleMat.metalness = 0;
        this.shuttleMat.map = feltTexture();
        this.shuttleMat.envMapIntensity = 0.3;
        this.shuttleMat.needsUpdate = true;
      }
      // Head shares the body's material so the hover glow covers all of Pip.
      const head = this.shuttle.getObjectByName('Head') as Mesh | undefined;
      if (head) head.material = this.shuttleMat;
      for (const n of ['WingL', 'WingR']) {
        const w = this.shuttle.getObjectByName(n);
        if (w) this.pipWings.push(w);
      }
      for (const n of ['EyeL', 'EyeR']) {
        const e = this.shuttle.getObjectByName(n);
        if (e) this.pipEyes.push(e);
      }
    } else {
      this.shuttleMat = new MeshStandardMaterial({ color: palette.shuttle, roughness: 0.55 });
      const cap = new Mesh(new CapsuleGeometry(0.0085, 0.04, 8, 16), this.shuttleMat);
      cap.rotation.z = Math.PI / 2;
      this.shuttle = new Group();
      this.shuttle.add(cap);
    }
    this.shuttle.name = 'Shuttle';
    add(this.shuttle);

    // Live preview of the next row (ghost cells at the fell).
    this.preview = new InstancedMesh(
      cellGeo,
      new MeshStandardMaterial({ transparent: true, opacity: 0.45, roughness: 1, depthWrite: false, map: weaveTexture() }),
      WARPS,
    );
    this.preview.name = 'PreviewRow';
    this.preview.frustumCulled = false;
    add(this.preview);

    // Undo bobbin: a small spool lying along X.
    if (models) {
      this.bobbin = cloneModel(models.bobbin, tint);
      const yarn = materialOf(this.bobbin, 'Wound') as MeshStandardMaterial | null;
      yarn?.color.setHex(UNDO_RED);
    } else {
      const bobMesh = new Mesh(new CapsuleGeometry(BOBBIN.radius, 0.014, 4, 12), new MeshStandardMaterial({ color: this.groundColor, roughness: 0.8 }));
      bobMesh.rotation.z = Math.PI / 2;
      this.bobbin = new Group();
      this.bobbin.add(bobMesh);
    }
    this.bobbin.name = 'Bobbin';
    this.bobbin.scale.setScalar(1.5); // big enough to read as a control
    // a tail of red yarn from the spool back onto the cloth: it 'rewinds' your last row
    this.undoTail = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(), new Vector3(0, 0, 0.01)]), 2, 0.0012, 5), new MeshStandardMaterial({ color: UNDO_RED, roughness: 0.95 }));
    this.undoTail.name = 'UndoTail';
    this.undoTail.castShadow = true;
    add(this.undoTail);
    add(this.bobbin);

    // Contact shadow decal.
    const shadow = new Mesh(
      new PlaneGeometry(0.42, 0.3),
      new MeshBasicMaterial({
        map: radialTexture(),
        transparent: true,
        depthWrite: false,
        color: 0x000000,
        opacity: 0.3,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.04, 0.0005, 0);
    shadow.renderOrder = -1;
    shadow.name = 'ContactShadow';
    shadow.visible = this.shadowOn;
    add(shadow);
    for (let k = 0; k < LEVERS; k++) this.placeKnob(k);
    // Parts bigger than a fingertip cast; only the bigger surfaces receive (self-shadow = depth).
    // Tiny parts (pegs, seams, stitches) would only add shadow-pass draw calls nobody sees.
    this.body.updateMatrixWorld(true);
    this.body.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || o.name === 'ContactShadow') return;
      if ((o as InstancedMesh).isInstancedMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        return;
      }
      const g = mesh.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const r = (g.boundingSphere?.radius ?? 0) * o.getWorldScale(_s).x;
      o.castShadow = r > 0.012;
      o.receiveShadow = r > 0.03;
    });
    this.card.mesh.castShadow = true;
  }

  /** Fallback frame when the Blender models are unavailable. */
  private buildProceduralFrame(theme: Theme, wood: MeshStandardMaterial, rail: MeshStandardMaterial, add: (...o: Object3D[]) => void): void {
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
  }

  setSide(side: 1 | -1): void {
    this.side = side;
    if (!this.slotPips) {
      const geo = new CylinderGeometry(0.0026, 0.0026, 0.0012, 14);
      this.slotPips = new InstancedMesh(geo, new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.8 }), 10);
      this.slotPips.name = 'SlotPips';
      this.slotPips.frustumCulled = false;
      this.root.add(this.slotPips);
    }
    this.layoutPips();
    // contact shadows: shelf, lever box, basket, the gift [x, z, width, depth]
    const spots: [number, number, number, number][] = [
      [-side * PLUSH.shelfX, PLUSH.shelfZ + 0.004, 0.31, 0.085],
      [side * (LEVER.firstX + 1.5 * LEVER.spacing), 0.052, 0.23, 0.15],
      [-side * BASKET.x, BASKET.z + 0.004, 0.135, 0.105],
      [-side * DAILY_BALL.x, DAILY_BALL.z + 0.004, 0.06, 0.06],
    ];
    if (!this.blobs.length) {
      const mat = new MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.26 });
      const geo = new PlaneGeometry(1, 1);
      for (let i = 0; i < spots.length; i++) {
        const b = new Mesh(geo, mat);
        b.name = 'ContactBlob';
        b.rotation.x = -Math.PI / 2;
        b.renderOrder = -1;
        this.root.add(b);
        this.blobs.push(b);
      }
    }
    for (let i = 0; i < spots.length; i++) {
      const [x, z, w, d] = spots[i];
      this.blobs[i].position.set(x, 0.0004, z);
      this.blobs[i].scale.set(w, d, 1);
    }
    this.weftSpools.children[0]?.position.set(side * SWAP.x, SWAP.y, SWAP.z);
    this.token.position.set(tokenX(side), TOKEN.y, TOKEN.z);
    this.nudges.position.set(nudgeX(side), NUDGE.y, 0);
    // Plaque leans on the front beam, shifted away from the token.
    const tilt = (PLAQUE.tiltDeg * Math.PI) / 180;
    // lying almost flat on the desk in front of the loom, clear of the cloth
    this.plaque.mesh.position.set(-side * 0.035, 0.004, LOOM.frontBeamZ + 0.05);
    this.plaque.mesh.rotation.set(-1.31, 0, 0); // ~15° up from flat
    this.layoutLevers();
    this.setBobbinT(0);
    this.placeCard();
    this.plushes.setSide(side);
    this.layUndoTail();
    this.basket.setSide(side);
    this.daily.setSide(side);
    this.mat.position.x = -side * MAT.offsetX;
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
      this.tracks?.setMatrixAt(k, _m);
      this.levers[k].visible = on;
      // unused slots get a wooden plug, so a 2-lever level doesn't look broken
      const plug = this.frameNode?.getObjectByName(`LeverSlotPlug${k}`);
      if (plug) {
        plug.visible = !on;
        if (!plug.userData.styled) {
          // a darker walnut filler standing proud with a rounded top: a closed slot, not a missing lever
          plug.userData.styled = true;
          plug.position.y = 0.0035;
          const pm = plug as Mesh;
          if (pm.material) pm.material = (pm.material as MeshStandardMaterial).clone();
          (pm.material as MeshStandardMaterial).color?.setHex(0x6b3e26);
        }
      }
      const dot = this.frameNode?.getObjectByName(`SlotDot${k}`);
      if (dot) dot.visible = on;
      for (let j = 0; j < 2; j++) {
        const a = this.frameNode?.getObjectByName(`SlotArrow${k}_${j}`);
        if (a) a.visible = on;
      }
    }
    if (this.tracks) this.tracks.instanceMatrix.needsUpdate = true;
    this.mirrorFrame();
  }

  /**
   * The model's lever block sits on the right; the card stand on the left.
   * Mirror both to match the player's lever side.
   */
  /**
   * The model is authored for a right-hand lever bank (levers right; crank and
   * bobbin rod left). For a left-hand bank, mirror those side-specific parts.
   * Mirroring is relative to the authored layout (geometry is often baked with
   * the node at the origin, so only the scale sign moves it).
   */
  private mirrorFrame(): void {
    const f = this.frameNode;
    if (!f) return;
    for (const child of f.children) {
      const n = child.name;
      const sided =
        n.startsWith('Lever') || n.startsWith('SlotFloor') || n.startsWith('FrontBeamCrank') || n.startsWith('FrontBeamHandle') || n.startsWith('BobbinRod');
      if (!sided) continue;
      if (child.userData.authoredX === undefined) child.userData.authoredX = child.position.x;
      child.position.x = (child.userData.authoredX as number) * this.side;
      child.scale.x = Math.abs(child.scale.x) * this.side;
    }
  }

  private undoTail: Mesh | null = null;

  /** The undo spool's yarn tail: from the spool, over the rail, onto the cloth's front corner. */
  private layUndoTail(): void {
    if (!this.undoTail) return;
    const bx = bobbinX(this.side);
    // slack: off the spool, down to the desk, under the rail, and onto the cloth's
    // outer edge (the selvedge), well away from the threads you're lifting
    const sx = -this.side;
    const pts = [
      new Vector3(bx - sx * 0.004, BOBBIN.y + 0.004, BOBBIN.z + 0.006),
      new Vector3(bx - sx * 0.012, 0.0016, BOBBIN.z + 0.014),
      new Vector3(sx * 0.14, 0.0016, LOOM.clothFrontZ + 0.01),
      new Vector3(sx * 0.123, 0.0028, LOOM.clothFrontZ + 0.002),
      new Vector3(sx * 0.104, 0.0062, LOOM.clothFrontZ - 0.004),
    ];
    this.undoTail.geometry.dispose();
    this.undoTail.geometry = new TubeGeometry(new CatmullRomCurve3(pts), 28, 0.002, 6);
  }

  setBobbinT(t: number): void {
    this.bobbin.position.set(bobbinX(this.side), BOBBIN.y, BOBBIN.z + BOBBIN.pull * t);
    this.bobbin.rotation.x = t * Math.PI * 3 + this.undoWiggle; // unspools as you pull (wiggles after a wrong row)
  }

  setTokenHighlight(level: 0 | 1 | 2): void {
    const s = level === 2 ? 1.25 : level === 1 ? 1.12 : 1;
    this.token.scale.setScalar(s * TOKEN_SIZE);
  }

  setBobbinHighlight(level: 0 | 1 | 2): void {
    const k = (level === 2 ? 0.45 : level === 1 ? 0.22 : 0) + this.undoGlow * 0.35 + this.undoHint * 0.3;
    if (k === this.bobbinGlowShown) return;
    this.bobbinGlowShown = k;
    this.bobbin.traverse((n) => {
      const m = (n as Mesh).material as MeshStandardMaterial | undefined;
      if (m?.emissive) m.emissive.copy(m.color).multiplyScalar(k);
    });
  }

  /** The newest row's verdict: a correct row flashes warm; a wrong one shakes, blinks its wrong cells, and the undo spool wiggles. */
  rowVerdict(good: boolean): void {
    this.rowFxT = 0;
    this.rowFxGood = good;
    if (!good) this.undoNudge = 1;
  }

  /** Animate the newest row (beat-in, flash or shake) by rewriting only its 8 cells. */
  private animateRow(dt: number): void {
    if (this.rowFxT < 0) return;
    this.rowFxT += dt;
    const t = this.rowFxT;
    const rows = this.rowsCache;
    const r = rows.length - 1;
    const done = t >= ROW_FX;
    if (r < 0 || this.cloth.count < WARPS) {
      this.rowFxT = -1;
      return;
    }
    const base = this.cloth.count - WARPS; // the newest row is written last
    const z0 = this.rowZ(r, rows.length);
    const row = rows[r];
    const want = this.target[r] ?? row;
    const shake = this.rowFxGood || done ? 0 : 0.0015 * Math.sin(t * 40) * Math.max(0, 1 - t / 0.35);
    for (let i = 0; i < WARPS; i++) {
      // beat in: each cell pops from 60% with a little overshoot, staggered along the row
      const ti = Math.max(0, Math.min(1, (t - i * 0.015) / 0.18));
      const pop = done ? 1 : 0.6 + 0.4 * backOut(ti);
      _p.set(warpX(i) + shake, 0.0062, z0);
      _m.compose(_p, _q.identity(), _s.set(WARP_PITCH * 0.95 * pop, 0.003 * (1 + (1 - pop)), LOOM.rowPitch * 0.86 * pop));
      this.cloth.setMatrixAt(base + i, _m);
      _c.setHex(isLifted(row, i) ? this.liftWoven : this.groundOf(row));
      if (!done) {
        if (this.rowFxGood) _c.lerp(_glow, 0.6 * Math.max(0, 1 - t / 0.25));
        else if (isLifted(row, i) !== isLifted(want, i) && (t < 0.12 || (t > 0.24 && t < 0.36))) _c.multiplyScalar(0.45); // the wrong cells blink
      }
      if (r === this.glowRow) _c.lerp(_glow, 0.55);
      this.cloth.setColorAt(base + i, _c);
    }
    this.cloth.instanceMatrix.needsUpdate = true;
    if (this.cloth.instanceColor) this.cloth.instanceColor.needsUpdate = true;
    if (done) this.rowFxT = -1;
  }

  /** Redraw the card, then stand it at the back corner opposite the bank. */
  placeCard(): void {
    const m = this.card.mesh;
    const tilt = (CARD.tiltDeg * Math.PI) / 180;
    const h = this.card.heightM;
    // Stands on the easel ledge behind the heddle.
    m.position.set(-this.side * CARD.x, CARD.baseY + (h / 2) * Math.cos(tilt), CARD.z - (h / 2) * Math.sin(tilt));
    m.rotation.set(-tilt, 0, 0);
  }

  /** Ghost cells for the row the next pass would weave. */
  setPreview(mask: Mask8, visible: boolean): void {
    this.preview.visible = visible;
    if (!visible) return;
    const z = this.fellZ - LOOM.rowPitch * 0.5;
    for (let i = 0; i < WARPS; i++) {
      _p.set(warpX(i), 0.0065, z);
      _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
      this.preview.setMatrixAt(i, _m);
      _c.setHex(isLifted(mask, i) ? this.liftColor : this.weftNowColor);
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

  /**
   * Lever k at logical t ∈ [0,1] (0 = rest, 1 = latched). Held levers track
   * the hand exactly; released ones spring there with a little overshoot.
   */
  setLeverT(k: number, t: number, held = false): void {
    this.leverTarget[k] = t;
    this.leverHeld[k] = held ? 1 : 0;
    if (held) {
      this.leverX[k] = t;
      this.leverV[k] = 0;
    }
    this.placeKnob(k);
  }

  private placeKnob(k: number): void {
    // Model knobs include their stem (origin on the block); the fallback
    // sphere is centred at knob height.
    const y = this.tracks ? LEVER.knobY : 0;
    this.levers[k]?.position.set(leverX(k, this.side), y, LEVER.restZ - LEVER.travel * this.leverX[k]);
  }

  /** Pip reacts: 'happy' (good row), 'sad' (wrong row), 'cheer' (picture finished). */
  setPipMood(m: 'happy' | 'sad' | 'cheer'): void {
    this.mood = m;
    this.moodT = 0;
  }

  /** Pip faces where it's flying, flaps while moving, and blinks now and then. */
  private animatePip(dt: number): void {
    const speed = Math.abs(this.shuttleVel);
    // Flying: face the way it's going. Perched: face into the loom.
    if (speed > 0.05) this.pipFacing = this.shuttleVel > 0 ? 1 : -1;
    else this.pipFacing = this.shuttleT < 0.5 ? 1 : -1;
    const want = this.pipFacing > 0 ? 0 : Math.PI;
    this.shuttle.rotation.y += (want - this.shuttle.rotation.y) * Math.min(1, dt * 10);
    const flap = Math.min(1, speed * 1.5);
    for (let i = 0; i < this.pipWings.length; i++) {
      const w = this.pipWings[i];
      w.rotation.x = (i === 0 ? 1 : -1) * Math.sin(this.clock * 32) * 0.55 * flap;
    }
    this.blinkIn -= dt;
    const closed = this.blinkIn < 0 && this.blinkIn > -0.12;
    for (const e of this.pipEyes) e.scale.y = closed ? 0.15 : 1;
    if (this.blinkIn <= -0.12) this.blinkIn = 2.5 + Math.random() * 3;
    this.animateMood(dt, speed);
  }

  /** Mood and idle motion on Pip's inner model (the outer group handles facing). */
  private animateMood(dt: number, speed: number): void {
    const p = this.pipInner;
    if (!p) return;
    let y = 0;
    let pitch = 0;
    let spin = 0;
    let look = 0;
    let squash = 1;
    const hop = (t: number, period: number, h: number) => h * Math.abs(Math.sin((Math.PI * t) / period));
    if (this.mood !== 'none') {
      this.moodT += dt;
      const t = this.moodT;
      if (this.mood === 'happy') {
        if (t < 0.7) y = hop(t, 0.35, 0.012);
        for (const w of this.pipWings) w.rotation.x *= 0; // reset, then flutter
        const flutter = t < 0.8 ? Math.sin(t * 40) * 0.7 : 0;
        this.pipWings.forEach((w, i) => (w.rotation.x = (i === 0 ? 1 : -1) * flutter));
        if (t > 0.2 && t < 0.6 && this.pipEyes[1]) this.pipEyes[1].scale.y = 0.15; // wink
        if (t > 1.0) this.mood = 'none';
      } else if (this.mood === 'sad') {
        const env = Math.min(1, t / 0.25) * Math.min(1, Math.max(0, (1.6 - t) / 0.4));
        pitch = -0.38 * env;
        squash = 1 - 0.08 * env;
        for (const e of this.pipEyes) e.scale.y = Math.min(e.scale.y, 1 - 0.5 * env);
        this.pipWings.forEach((w, i) => (w.rotation.x = (i === 0 ? -1 : 1) * 0.25 * env));
        if (t > 1.6) this.mood = 'none';
      } else {
        if (t < 1.2) y = hop(t, 0.4, 0.02);
        spin = t < 1.2 ? Math.PI * 2 * Math.min(1, t / 1.2) : 0;
        const flutter = t < 1.4 ? Math.sin(t * 38) * 0.8 : 0;
        this.pipWings.forEach((w, i) => (w.rotation.x = (i === 0 ? 1 : -1) * flutter));
        if (t > 1.5) this.mood = 'none';
      }
    } else if (speed < 0.05) {
      // idle on the perch: now and then look around, or a tiny hop
      this.idleIn -= dt;
      if (this.idleIn < 0) {
        const t = -this.idleIn;
        if (this.idleKind === 0) look = Math.sin((t / 0.9) * Math.PI * 2) * 0.45;
        else y = hop(t, 0.25, 0.006);
        if (t > (this.idleKind === 0 ? 0.9 : 0.5)) {
          this.idleIn = 3.5 + Math.random() * 4;
          this.idleKind = 1 - this.idleKind;
        }
      }
    }
    // picked up: a quick squash and stretch with the wings flared
    let sx = 1;
    if (this.pipGrabT >= 0) {
      this.pipGrabT += dt;
      const g = this.pipGrabT;
      const k = g < 0.08 ? g / 0.08 : Math.max(0, 1 - (g - 0.08) / 0.22);
      squash *= 1 - 0.15 * k;
      sx = 1 + 0.1 * k;
      if (g < 0.3) this.pipWings.forEach((w, i) => (w.rotation.x = (i === 0 ? 1 : -1) * 0.9 * k));
      if (g > 0.3) this.pipGrabT = -1;
    }
    // flying: lean into the motion
    this.pipLean += (-0.18 * Math.min(1, speed * 2) - this.pipLean) * Math.min(1, dt * 10);
    p.position.y = y;
    p.rotation.set(0, spin + look, pitch + this.pipLean);
    p.scale.set(0.95 * sx, 0.95 * squash, 0.95 * sx);
  }

  /** Visual twin for one plucked warp: it twangs. */
  pluckWarp(i: number): void {
    this.twang[i] = 1;
    this.warpVel[i] += 3; // a visible bounce at arm's length, not just a shimmer
  }

  /** A new picture arrives: the card springs in and the ghost picture fades up. */
  arrive(): void {
    this.arriveT = 0;
    this.setPipMood('happy');
  }

  private animateArrival(dt: number): void {
    if (this.arriveT < 0) return;
    this.arriveT += dt;
    const t = this.arriveT;
    // card: 0.9 → 1.05 → 1 (a damped spring)
    const k = Math.min(1, t / 0.55);
    const sc = 1 + (-0.1 * Math.cos(k * Math.PI * 2.5)) * Math.pow(1 - k, 2);
    this.card.setPop(sc);
    const gm = this.ghostCloth?.material as MeshBasicMaterial | undefined;
    if (gm) gm.opacity = GHOST_OPACITY * Math.min(1, Math.max(0, (t - 0.15) / 0.5));
    if (t >= 0.7) {
      this.card.setPop(1);
      if (gm) gm.opacity = GHOST_OPACITY;
      this.arriveT = -1;
    }
  }

  /** Where the next row will be woven (z). */
  get fellZNow(): number {
    return this.fellZ;
  }

  /** Pip is picked up: a quick squash, wings flared. */
  grabPip(): void {
    this.pipGrabT = 0;
  }

  /** `glow` (0–1) adds a smooth breathing light on top (tutorial), never a hard blink. */
  setLeverHighlight(k: number, level: 0 | 1 | 2, latched: boolean, glow = 0): void {
    this.knobLevel[k] = level;
    const mat = this.leverMats[k];
    const e = (level === 2 ? 0.45 : level === 1 ? 0.22 : latched ? 0.1 : 0) + glow * 0.3;
    mat.emissive.copy(mat.color).multiplyScalar(e);
  }

  setShuttleT(t: number, dt = 0): void {
    // A jump (undo, a new level) is shown as a quick glide home, never a teleport.
    if (dt > 0 && this.glideT < 0 && Math.abs(t - this.shuttleT) > 0.3) {
      this.glideFrom = this.shuttleT;
      this.glideT = 0;
    }
    if (this.glideT >= 0) {
      this.glideT += dt;
      const k = Math.min(1, this.glideT / 0.32);
      const e = 1 - Math.pow(1 - k, 3);
      if (k >= 1) this.glideT = -1;
      else t = this.glideFrom + (t - this.glideFrom) * e;
    }
    if (dt > 0) {
      const v = (t - this.shuttleT) / dt;
      // Arriving at an end with speed: squash on impact.
      const atEnd = (t <= 0 || t >= 1) && t !== this.shuttleT;
      if (atEnd && Math.abs(this.shuttleVel) > 0.4) this.squash = 1;
      this.shuttleVel = v;
    }
    const xPrev = this.shuttle.position.x;
    this.shuttleT = t;
    const x = SHUTTLE.minX + (SHUTTLE.maxX - SHUTTLE.minX) * t;
    this.shuttle.position.set(x, shuttleY(x), SHUTTLE.z);
    // a little trail of weft fluff behind Pip as it flies through the shed
    this.trailDist += Math.abs(x - xPrev);
    if (this.trailDist > 0.025 && Math.abs(x) < SHUTTLE.shedHalf + 0.02) {
      this.trailDist = 0;
      this.fx.puff(x - Math.sign(x - xPrev) * 0.012, shuttleY(x) + 0.004, SHUTTLE.z, this.weftNowColor, 1);
    }
  }

  setShuttleHighlight(level: 0 | 1 | 2, glow = 0): void {
    this.shuttleMat.emissive.copy(this.shuttleMat.color).multiplyScalar((level === 2 ? 0.6 : level === 1 ? 0.3 : 0) + glow * 0.32);
    this.boatMat?.emissive.copy(this.boatMat.color).multiplyScalar((level === 2 ? 0.5 : level === 1 ? 0.28 : 0) + glow * 0.3);
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

  /**
   * Cloth builds like a real frame loom: row 0 by the front beam, each new row
   * beaten in behind it toward the heddle. (If wrong rows overflow the space,
   * the newest stays at the back and older ones slide forward.)
   */
  /** A lever clicks into place: its knob pops and a puff of felt fluff in its colour comes off the slot. */
  latchPop(k: number, latched: boolean): void {
    this.revealPop[k] = Math.max(this.revealPop[k], latched ? 0.45 : 0.3);
    const z = latched ? LEVER.restZ - LEVER.travel - 0.004 : LEVER.restZ + 0.004;
    this.fx.puff(leverX(k, this.side), 0.032, z, this.tieHidden[k] ? 0xd9cdb8 : this.palette.knobs[k], latched ? 4 : 2);
  }

  /** Notes float up off a woven row as the finished cloth plays it (one or two, from its picture threads). */
  singRow(r: number): void {
    const rows = this.rowsCache;
    const row = rows[r];
    if (row === undefined) return;
    // while its plush dances, the notes come out of the plush: it's singing its picture
    const head = this.plushes.heroHead(this.tmpHead);
    if (head) {
      this.fx.note(head.x + (r % 2 ? 0.035 : -0.035), head.y, head.z, this.liftColor);
      return;
    }
    const z = this.rowZ(r, rows.length);
    let n = 0;
    for (let i = (r * 3) % WARPS, k = 0; k < WARPS && n < 2; k++, i = (i + 3) % WARPS) {
      if (!isLifted(row, i)) continue;
      this.fx.note(warpX(i), 0.03, z, this.liftColor);
      n++;
    }
  }

  private tmpHead = new Vector3();

  private rowZ(r: number, count: number): number {
    const shift = Math.max(0, count - LOOM.maxRows);
    return LOOM.clothFrontZ - (r - shift + 0.5) * LOOM.rowPitch;
  }

  /** Rows, oldest first. */
  setRows(rows: readonly Mask8[]): void {
    const added = rows.length === this.rowsCache.length + 1;
    if (rows.length === this.rowsCache.length - 1 && this.rowsCache.length > 0) {
      // unpicked: the row comes apart in a puff of its own yarn
      const r = this.rowsCache.length - 1;
      const gone = this.rowsCache[r];
      const z = this.rowZ(r, this.rowsCache.length);
      for (let i = 0; i < WARPS; i++) this.fx.puff(warpX(i), 0.012, z, isLifted(gone, i) ? this.liftColor : this.groundOf(gone), 2);
    }
    this.rowsCache = rows;
    if (added) {
      // the row is beaten in: a puff of fluff along it, in each cell's yarn colour
      const r = rows.length - 1;
      const z = this.rowZ(r, rows.length);
      for (let i = 0; i < WARPS; i++) this.fx.puff(warpX(i), 0.01, z, isLifted(rows[r], i) ? this.liftColor : this.groundOf(rows[r]), 2);
    }
    const n = Math.min(rows.length, LOOM.visibleRows);
    const start = rows.length - n;
    let idx = 0;
    for (let r = 0; r < n; r++) {
      const row = rows[start + r];
      const z = this.rowZ(start + r, rows.length);
      if (z > LOOM.clothFrontZ) continue; // slid off the front (only with many wrong rows)
      for (let i = 0; i < WARPS; i++) {
        _p.set(warpX(i), 0.0062, z);
        // slightly domed yarn cells with a little gap (the felt shows as the seam)
        _m.compose(_p, _q.identity(), _s.set(WARP_PITCH * 0.95, 0.003, LOOM.rowPitch * 0.86));
        this.cloth.setMatrixAt(idx, _m);
        // warp visible if lifted in that row, else weft visible
        _c.setHex(isLifted(row, i) ? this.liftWoven : this.groundOf(row));
        if (start + r === this.glowRow) _c.lerp(_glow, 0.55);
        this.cloth.setColorAt(idx, _c);
        idx++;
      }
    }
    this.cloth.count = idx;
    this.cloth.instanceMatrix.needsUpdate = true;
    if (this.cloth.instanceColor) this.cloth.instanceColor.needsUpdate = true;
    // the fell (where the next row goes) moves back as the cloth grows
    this.fellZ = this.rowZ(rows.length, rows.length + 1) + LOOM.rowPitch / 2;
    this.writeTarget();
    this.writeWarps();
  }

  /** Hide or show the ghost picture (caller co-op). */
  setTargetHidden(h: boolean): void {
    this.hideTarget = h;
    this.writeTarget();
  }

  /** The whole picture, faint, on the rows still to weave: you watch it fill in. */
  setTarget(target: readonly Mask8[]): void {
    this.target = target;
    this.writeTarget();
  }
  private target: readonly Mask8[] = [];

  /** Caller co-op: no ghost picture on the loom (only the phone knows it). */
  hideTarget = false;

  private writeTarget(): void {
    if (!this.ghostCloth) return;
    let idx = 0;
    const done = this.rowsCache.length;
    if (this.rowsCache.length < LOOM.maxRows && !this.hideTarget) {
      for (let r = done; r < this.target.length && r < LOOM.maxRows; r++) {
        const z = this.rowZ(r, done);
        const water = this.target[r] & WEFT_B && this.weftColor !== null;
        for (let i = 0; i < WARPS; i++) {
          // only the picture's own pixels (and Sea's water rows), faint: no grey "canvas" cells
          const px = isLifted(this.target[r], i);
          if (!px && !water) continue;
          _p.set(warpX(i), 0.0049, z);
          _m.compose(_p, _q.identity(), _s.set(0.9, 0.15, 0.88)); // flat faint tile on the felt
          this.ghostCloth.setMatrixAt(idx, _m);
          // the row to weave next is bright; later rows sink toward the navy felt
          _c.setHex(px ? this.liftColor : (this.weftColor as number));
          if (r === done) _c.lerp(_c2.setHex(0xfff4dc), 0.1); // the next row: the picture's own colour, bright
          else _c.lerp(_c2.setHex(0x2c3a66), 0.55).lerp(_c2.setHex(0x8a8fa8), 0.12); // later rows: dim, not muddy
          this.ghostCloth.setColorAt(idx, _c);
          idx++;
        }
      }
    }
    this.ghostCloth.count = idx;
    // a small arrow on the left of the bed points at the row to weave next (like the card's arrow)
    const next = done < this.target.length && done < LOOM.maxRows;
    this.rowArrow.visible = next; // the arrow still says which row is next
    if (next) {
      this.rowArrow.position.set(warpX(0) - WARP_PITCH * 1.05, 0.008, this.rowZ(done, done));
      this.rowArrowMat.color.setHex(this.liftColor);
    }
    this.ghostCloth.instanceMatrix.needsUpdate = true;
    if (this.ghostCloth.instanceColor) this.ghostCloth.instanceColor.needsUpdate = true;
  }

  /** Brief visual twin for every sound (deaf/HoH accessibility). */
  pulseWarp(): void {
    this.pulse = 1;
  }

  update(dt: number): void {
    let dirty = false;
    this.clock += dt;
    const h = Math.min(dt, 1 / 60);
    // Lever springs: ω≈30 rad/s, ζ≈0.45 → one visible overshoot.
    for (let k = 0; k < LEVERS; k++) {
      if (this.leverHeld[k]) continue;
      const x = this.leverX[k];
      const d = this.leverTarget[k] - x;
      if (Math.abs(d) < 1e-4 && Math.abs(this.leverV[k]) < 1e-3) {
        if (x !== this.leverTarget[k]) {
          this.leverX[k] = this.leverTarget[k];
          this.placeKnob(k);
        }
        continue;
      }
      this.leverV[k] += (900 * d - 27 * this.leverV[k]) * h;
      this.leverX[k] += this.leverV[k] * h;
      this.placeKnob(k);
    }
    // Shuttle squash-and-stretch (capsule's local Y is its length).
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 3.2);
      const s = Math.sin((1 - this.squash) * Math.PI * 3) * this.squash;
      // Squash along the body (Pip's length is X), bulge across it.
      this.shuttle.scale.set(1 - 0.28 * s, 1 + 0.18 * s, 1 + 0.18 * s);
    } else if (this.shuttle.scale.x !== 1) {
      this.shuttle.scale.set(1, 1, 1);
    }
    this.animatePip(dt);
    this.animateRow(dt);
    this.animateArrival(dt);
    if (this.rowArrow.visible) this.rowArrow.scale.setScalar(1.35 + 0.2 * Math.sin(this.clock * 4)); // a gentle beckon
    if (this.undoNudge > 0) {
      this.undoNudge = Math.max(0, this.undoNudge - dt / 0.9);
      const k = 1 - this.undoNudge;
      this.undoWiggle = 0.3 * Math.sin(k * Math.PI * 6) * this.undoNudge;
      this.undoGlow = Math.sin(k * Math.PI);
    } else if (this.undoWiggle !== 0 || this.undoGlow !== 0) {
      this.undoWiggle = 0;
      this.undoGlow = 0;
    }
    // Knob juice: swell on hover, squash on grab, springy bounce on release.
    for (let k = 0; k < LEVERS; k++) {
      const lv = this.knobLevel[k];
      const tw = lv === 2 ? 1.14 : lv === 1 ? 1.1 : 1;
      const th = lv === 2 ? 0.82 : lv === 1 ? 1.1 : 1;
      this.knobVW[k] += (420 * (tw - this.knobW[k]) - 16 * this.knobVW[k]) * h;
      this.knobVH[k] += (420 * (th - this.knobH[k]) - 16 * this.knobVH[k]) * h;
      this.knobW[k] += this.knobVW[k] * h;
      this.knobH[k] += this.knobVH[k] * h;
      let pop = 1;
      if (this.revealPop[k] > 0) {
        this.revealPop[k] = Math.max(0, this.revealPop[k] - dt * 2.2);
        const p = this.revealPop[k];
        pop = 1 + Math.sin((1 - p) * Math.PI * 3) * p * 0.35;
      }
      const cap = this.knobCaps[k];
      if (cap) {
        const b = cap.userData.baseScale as [number, number, number] | undefined;
        cap.scale.set((b?.[0] ?? 1) * this.knobW[k] * pop, (b?.[1] ?? 1) * this.knobH[k] * pop, (b?.[2] ?? 1) * this.knobW[k] * pop);
      }
      else this.levers[k]?.scale.setScalar(pop);
    }
    this.plushes.update(dt);
    this.basket.update(dt);
    this.daily.update(dt);
    // a contact shadow only where its object is on the desk
    if (this.blobs.length === 4) {
      this.blobs[0].visible = this.plushes.shelfShown;
      this.blobs[2].visible = this.basket.root.visible;
      this.blobs[3].visible = this.daily.root.visible;
    }
    this.fx.update(dt);
    // Twang decay.
    for (let i = 0; i < WARPS; i++) {
      if (this.twang[i] > 0) {
        this.twang[i] = Math.max(0, this.twang[i] - dt * 2.2);
        dirty = true;
      }
    }
    // Springy lift: threads pop up with a small overshoot and settle.
    for (let i = 0; i < WARPS; i++) {
      const target = isLifted(this.targetShed, i) ? 1 : this.hoverLift(i);
      const d = target - this.warpLift[i];
      if (Math.abs(d) > 1e-4 || Math.abs(this.warpVel[i]) > 1e-3) {
        this.warpVel[i] += (520 * d - 26 * this.warpVel[i]) * h;
        this.warpLift[i] += this.warpVel[i] * h;
        dirty = true;
      } else if (this.warpVel[i] !== 0) {
        this.warpVel[i] = 0;
        this.warpLift[i] = target;
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
      const a = this.twang[i];
      const x = warpX(i) + (a > 0 ? Math.sin(this.clock * 85 + i) * 0.0045 * a * a : 0);
      const hy = LOOM.loweredY + (LOOM.liftedY - LOOM.loweredY) * this.warpLift[i];
      // Lowered threads are cream yarn; lifted ones take the picture colour.
      // Touching a lever lights its threads in the lever's colour (motion + colour,
      // no icons): that's how you see which threads a lever lifts.
      const lift = Math.max(0, Math.min(1, this.warpLift[i]));
      // A lifted thread takes the colour of the lever lifting it: lever ↔ threads
      // are linked by colour all the time, with no icons on the loom.
      _c.setHex(THREAD_CREAM).lerp(_c2.setHex(this.liftingLeverColor(i)), lift);
      if (a > 0) _c.lerp(_white, 0.4 * a * a); // a plucked thread flashes
      const hk = this.hoverLever;
      if (hk >= 0 && hk < this.tieUp.length && !this.tieHidden[hk] && isLifted(this.tieUp[hk], i)) {
        _c.lerp(_c2.setHex(this.palette.knobs[hk]), 0.75).lerp(_glow, 0.15);
      }
      for (let s = 0; s < STRANDS; s++) {
        const dx = (s - (STRANDS - 1) / 2) * STRAND_GAP;
        const n = (i * STRANDS + s) * 3;
        this.segment(n, x + dx, LOOM.beamY + 0.007, LOOM.backBeamZ, x + dx * 0.3, hy, LOOM.heddleZ);
        this.segment(n + 1, x + dx * 0.3, hy, LOOM.heddleZ, x + dx, fellY, this.fellZ);
        // under the woven cells (they cover it; it shows only in the seams)
        this.segment(n + 2, x + dx, 0.0028, this.fellZ, x + dx, 0.0028, LOOM.clothFrontZ + 0.006);
        this.warps.setColorAt(n, _c);
        this.warps.setColorAt(n + 1, _c);
        this.warps.setColorAt(n + 2, _c);
      }
      // heddle cord from the bar down to the eyelet, eyelet around the warp
      const top = HEDDLE_BAR_BOTTOM_Y;
      const bottom = hy + 0.0033;
      _p.set(x, (top + bottom) / 2, LOOM.heddleZ);
      _m.compose(_p, _q.identity(), _s.set(1, Math.max(0.001, top - bottom), 1));
      this.cords.setMatrixAt(i, _m);
      _p.set(x, hy, LOOM.heddleZ);
      _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
      this.eyes.setMatrixAt(i, _m);
    }
    this.cords.instanceMatrix.needsUpdate = true;
    this.eyes.instanceMatrix.needsUpdate = true;
    this.warps.instanceMatrix.needsUpdate = true;
    if (this.warps.instanceColor) this.warps.instanceColor.needsUpdate = true;
    this.writeTies();
  }

  /** Threads the hovered lever would lift peek up a little (not for mystery levers). */
  private hoverLift(i: number): number {
    const k = this.hoverLever;
    if (k < 0 || k >= this.tieUp.length || this.tieHidden[k]) return 0;
    return isLifted(this.tieUp[k], i) ? 0.22 : 0;
  }

  /**
   * The level's colours and tie-up. `color` is the picture colour (lifted
   * threads); null falls back to the theme's weft colour.
   */
  setPicture(color: number | null, tieUp: readonly Mask8[], hidden: readonly boolean[] = []): void {
    this.pictureColor = color;
    this.tieUp = tieUp;
    this.layoutPips();
    this.tieHidden = tieUp.map((_, k) => !!hidden[k]);
    this.applyColors();
    for (let k = 0; k < LEVERS; k++) this.dyeLever(k);
    this.setRows(this.rowsCache);
    this.writeWarps();
  }

  /**
   * Capture-only "photo set" for marketing shots: a walnut desktop under the
   * loom and a warm backdrop round it (hides the emulator's placeholder room).
   * Never on in the game.
   */
  photoSet(on: boolean): void {
    if (on && !this.photo) {
      const g = new Group();
      g.name = 'PhotoSet';
      // a plain pale-maple tabletop (a busy grain read as sand dunes)
      const desk = new Mesh(new PlaneGeometry(1.8, 1.1), new MeshStandardMaterial({ color: 0xe2c29c, roughness: 0.62 }));
      desk.rotation.x = -Math.PI / 2;
      desk.position.set(0, -0.0008, 0.12);
      desk.receiveShadow = true;
      const c = document.createElement('canvas');
      c.width = 4;
      c.height = 256;
      const x = c.getContext('2d')!;
      const grd = x.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#fbf1dc');
      grd.addColorStop(0.55, '#f1d9b4');
      grd.addColorStop(1, '#d9ac78');
      x.fillStyle = grd;
      x.fillRect(0, 0, 4, 256);
      const bgTex = new CanvasTexture(c);
      bgTex.colorSpace = SRGBColorSpace;
      const back = new Mesh(new SphereGeometry(1.6, 32, 16), new MeshBasicMaterial({ map: bgTex, side: BackSide, depthWrite: false }));
      back.renderOrder = -10;
      g.add(back, desk);
      this.photo = g;
      this.root.add(g);
    }
    if (this.photo) this.photo.visible = on;
  }
  private photo: Group | null = null;

  /** Sea: the level's second weft colour (null: a single cream weft). */
  setWeftColor(color: number | null): void {
    this.weftColor = color;
    this.weftNow = 0;
    this.weftSpools.visible = color !== null;
    this.dyeSwapSpools();
    this.applyColors();
    this.setRows(this.rowsCache);
    this.writeTarget();
  }

  /** Pip's boat now carries this weft: its yarn turns that colour with a little puff. */
  setWeftNow(w: 0 | 1): void {
    if (w === this.weftNow) return;
    this.weftNow = w;
    this.boatYarn?.color.setHex(this.weftNowColor);
    this.pipBall.color.setHex(this.weftNowColor);
    this.dyeSwapSpools();
    const p = this.shuttle.position;
    this.fx.puff(p.x, p.y + 0.01, p.z, this.weftNowColor, 6);
    this.pipGrabT = 0; // a happy little squash
  }

  /** The swap spools show the yarn you'd swap TO. */
  private dyeSwapSpools(): void {
    const other = this.weftNow ? this.groundColor : (this.weftColor ?? this.groundColor);
    this.swapYarnMat.color.setHex(other);
  }

  /** Where the swap spool sits (loom space): in front of the perch on the lever side. */
  swapSpoolPos(out: { x: number; y: number; z: number }): typeof out {
    out.x = this.side * SWAP.x;
    out.y = SWAP.y;
    out.z = SWAP.z;
    return out;
  }

  /** Swap spools: hovered/held glow, or a tutorial breath. */
  setSwapHighlight(level: 0 | 1 | 2, glow = 0): void {
    this.swapYarnMat.emissive.copy(this.swapYarnMat.color).multiplyScalar((level === 2 ? 0.45 : level === 1 ? 0.25 : 0) + glow * 0.3);
    const s = level ? 1.12 : 1;
    for (const c of this.weftSpools.children) c.scale.setScalar(s);
  }

  /** The weft Pip carries right now. */
  get weftNowColor(): number {
    return this.weftNow && this.weftColor !== null ? this.weftColor : this.groundColor;
  }

  /** A woven or target row's ground (unlifted) colour: cream, or the second weft. */
  private groundOf(row: number): number {
    return row & WEFT_B && this.weftColor !== null ? this.weftColor : this.groundColor;
  }

  /** Mystery levers are undyed wool until tried; then they take their colour. */
  private dyeLever(k: number): void {
    const hidden = !!this.tieHidden[k];
    // an undyed (mystery) lever wears a darker stitched seam ring round its cap
    const cap = this.knobCaps[k];
    if (cap) {
      let ring = cap.getObjectByName('MysterySeam') as Mesh | undefined;
      if (!ring && hidden) {
        ring = new Mesh(new TorusGeometry(LEVER.knobRadius * 1.0, 0.0026, 8, 32), new MeshStandardMaterial({ color: 0x3a3550, roughness: 0.9 }));
        ring.name = 'MysterySeam';
        ring.rotation.x = Math.PI / 2;
        // the cap's vertices are baked at knob height: sit the seam on the dome's equator
        const g = (cap as Mesh).geometry;
        if (g) {
          g.computeBoundingBox();
          g.boundingBox!.getCenter(ring.position);
        }
        cap.add(ring);
        ring.add(mysteryMark()); // a stitched '?' on the dome (child of the ring: shown and hidden with it)
      }
      if (ring) ring.visible = hidden;
    }
    const hex = hidden ? UNDYED : this.palette.knobs[k];
    this.leverMats[k]?.color.setHex(hex);
    this.wrapMats[k]?.color.setHex(hex).multiplyScalar(0.82);
    const dot = this.frameNode?.getObjectByName(`SlotDot${k}`) as Mesh | undefined;
    (dot?.material as MeshStandardMaterial | undefined)?.color.setHex(hex);
    for (let j = 0; j < 2; j++) {
      const a = this.frameNode?.getObjectByName(`SlotArrow${k}_${j}`) as Mesh | undefined;
      (a?.material as MeshStandardMaterial | undefined)?.color.setHex(hex);
    }
  }

  /** Reveal a mystery lever's ties once it has been tried. */
  revealLever(k: number): boolean {
    if (!this.tieHidden[k]) return false;
    this.tieHidden[k] = false;
    this.dyeLever(k);
    this.revealPop[k] = 1;
    this.writeTies();
    return true;
  }

  /** Lever whose threads should peek up (-1 for none). */
  setHoverLever(k: number): void {
    if (k === this.hoverLever) return;
    this.hoverLever = k;
    this.writeWarps();
    this.writeTies();
  }

  private applyColors(): void {
    const p = this.palette;
    this.liftColor = this.pictureColor ?? p.weft;
    this.liftWoven = _c.setHex(this.liftColor).offsetHSL(0, 0.08, 0.05).getHex(); // woven yarn: a touch richer than the ghost
    this.groundColor = 0xe2d2b2; // oatmeal yarn: the picture colour is the brightest thing on the cloth: the picture colour reads against it, not white tile
    // warp colour comes per strand (instance colour × white), brighter when lifted
    (this.warps?.material as MeshStandardMaterial | undefined)?.color.setHex(0xffffff);
    const yarn = this.bobbin ? (materialOf(this.bobbin, 'Wound') as MeshStandardMaterial | null) : null;
    yarn?.color.setHex(UNDO_RED);
    this.boatYarn?.color.setHex(this.weftNowColor);
    this.pipBall.color.setHex(this.weftNowColor);
  }

  /** One knot per (lever, lifted thread), riding the warp just in front of the heddle. */
  private writeTies(): void {
    if (!this.ties.length) return;
    const fellY = 0.006;
    for (const m of this.ties) m.count = 0;
    for (let k = 0; k < this.tieUp.length && k < this.activeLevers; k++) {
      const mesh = this.ties[k % this.ties.length];
      if (this.tieHidden[k]) continue;
      const mask = this.tieUp[k];
      // stacked along the warp: lever 0 nearest the heddle
      const f = 0.1 + 0.13 * k;
      let n = mesh.count;
      for (let i = 0; i < WARPS; i++) {
        if (!isLifted(mask, i)) continue;
        const hy = LOOM.loweredY + (LOOM.liftedY - LOOM.loweredY) * this.warpLift[i];
        _p.set(warpX(i), hy + (fellY - hy) * f + 0.0012, LOOM.heddleZ + (this.fellZ - LOOM.heddleZ) * f);
        const big = k === this.hoverLever ? 1.4 : 1;
        _m.compose(_p, _q.identity(), _s.set(big, big, big));
        mesh.setMatrixAt(n, _m);
        _c.setHex(this.palette.knobs[k]);
        if (k === this.hoverLever) _c.lerp(_glow, 0.35);
        mesh.setColorAt(n, _c);
        n++;
      }
      mesh.count = n;
    }
    for (const m of this.ties) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Colour of the latched (or rising) lever that lifts thread i most. */
  private liftingLeverColor(i: number): number {
    let best = -1;
    let bestT = 0.05;
    for (let k = 0; k < this.tieUp.length && k < this.activeLevers; k++) {
      if (isLifted(this.tieUp[k], i) && this.leverX[k] > bestT) {
        bestT = this.leverX[k];
        best = k;
      }
    }
    if (best < 0) return this.liftColor;
    return this.tieHidden[best] ? 0xd9cdb8 : this.palette.knobs[best];
  }

  /** Instance `idx` as a unit-Z strand stretched from (x0,y0,z0) to (x1,y1,z1). */
  private segment(idx: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    _a.set(x0, y0, z0);
    _b.set(x1, y1, z1).sub(_a);
    const len = _b.length();
    _p.copy(_a).addScaledVector(_b, 0.5);
    _q.setFromUnitVectors(Z_AXIS, _b.multiplyScalar(1 / len));
    _m.compose(_p, _q, _s.set(1, 1, len));
    this.warps.setMatrixAt(idx, _m);
  }
}

/** Two chunky arrows: up (further) and down (nearer). */
function makeNudges(): Group {
  const g = new Group();
  g.name = 'NudgeArrows';
  const mat = new MeshStandardMaterial({ color: 0xf2b632, roughness: 0.6 });
  const base = new MeshStandardMaterial({ color: 0x2b2118, roughness: 1 });
  for (const [dir, z] of [[1, NUDGE.upZ], [-1, NUDGE.downZ]] as const) {
    const cone = new Mesh(new CylinderGeometry(0, NUDGE.radius, 0.018, 20), mat);
    cone.position.set(0, 0.004, z);
    cone.rotation.x = dir > 0 ? 0 : Math.PI;
    cone.name = dir > 0 ? 'NudgeUp' : 'NudgeDown';
    const disc = new Mesh(new CylinderGeometry(NUDGE.radius * 1.15, NUDGE.radius * 1.15, 0.004, 20), base);
    disc.position.set(0, -NUDGE.y + 0.002, z);
    g.add(cone, disc);
  }
  return g;
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
  // a cream ring round the edge: it reads as a button you can press, not a stray disc
  const edge = new Mesh(new TorusGeometry(TOKEN.radius, 0.0016, 8, 40), new MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.6 }));
  edge.rotation.x = Math.PI / 2;
  g.add(edge);
  return g;
}

function disposeTree(o: Object3D): void {
  o.traverse((n) => {
    if ((n as InstancedMesh).isInstancedMesh) (n as InstancedMesh).dispose();
    const m = n as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) {
      // shared procedural textures (weave, grain) are kept
      mat.dispose();
    }
  });
}

let radialTex: CanvasTexture | null = null;
function radialTexture(): CanvasTexture {
  if (radialTex) return radialTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  radialTex = new CanvasTexture(c);
  return radialTex;
}

export { UP };

/** A dark stitched '?' printed on the top of a mystery lever's dome (in the seam ring's space:
 * the ring is rotated +90° about x, so the dome's up is the ring's -z). */
function mysteryMark(): Mesh {
  const R = LEVER.knobRadius * 1.012;
  const th = 0.9; // a wide patch: the '?' spans most of the dome seen from the seat
  const geo = new SphereGeometry(R, 28, 8, 0, Math.PI * 2, 0, th);
  const w = R * Math.sin(th);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * w), 0.5 - pos.getZ(i) / (2 * w));
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '900 128px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#f3e6cc';
  g.strokeText('?', 64, 72);
  g.fillStyle = '#2b3a67';
  g.fillText('?', 64, 72);
  g.lineWidth = 9; // a bolder stitched glyph that reads from the seat
  g.strokeStyle = '#2b3a67';
  g.strokeText('?', 64, 72);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(geo, new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.name = 'MysteryMark';
  m.rotation.x = -Math.PI / 2; // undo the ring's turn: dome up again
  return m;
}
