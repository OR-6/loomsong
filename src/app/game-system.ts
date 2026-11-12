/**
 * GameSystem: "set the table" placement, then per-frame loom interaction.
 * Reads hand state from HandTrackerSystem, converts it to loom-local space,
 * drives LoomController, and syncs LoomView.
 */
import { reportFrameError } from './safe.js';
import {
  createSystem,
  InstancedMesh,
  MeshBasicMaterial,
  SphereGeometry,
  Matrix4,
  Vector3,
  Group,
  Quaternion,
  VisibilityState,
  XRAnchor,
  XRPlane,
  SceneUnderstandingSystem,
  type Object3D,
  type Entity,
  PCFShadowMap,
} from '@iwsdk/core';
import { BASKET, BOBBIN, CARD, LEVER, LEVERS, LOOM, NUDGE, PLACE, SHUTTLE, TOKEN, WARPS, bobbinX, leverX, nudgeX, skeinPos, tokenX, shuttleY, warpX } from '../config.js';
import { applyCalibration, hands, calibration, type Side } from '../input/hands.js';
import { Calibrator } from '../input/calibration.js';
import { LoomController, type HandInput } from '../loom/loom-controller.js';
import { LoomModel } from '../loom/loom-model.js';
import { FRIEND_SEAT, TOKEN_SIZE, LoomView } from '../loom/loom-view.js';
import { Placement, loomPose } from './placement.js';
import { Label } from '../ui/label.js';
import { audio } from '../audio/synth.js';
import { keyFor } from '../audio/soundtrack.js';
import { LevelFlow, TIMING, type HintStep } from './level-flow.js';
import { CHAPTERS, DAILY_LEVELS, LEVELS, THANKS_LEVEL, chapterStates, dailyLevel, dayKey, levelAt, pictureById, streakOf } from '../puzzle/catalog.js';
import type { Level } from '../puzzle/levels.js';
import { PLUSH, ROW_BEAT, SPOTS, type DeskItem, type ShelfItem } from '../loom/plush.js';
import { DAILY_BALL } from '../loom/daily-ball.js';
import { TOY_PHONE } from '../loom/toy-phone.js';
import { motion, prefersReducedMotion } from '../ui/motion.js';
import { QUILT_W, buildQuilt } from '../loom/quilt.js';
import { isLifted } from '../puzzle/tieup.js';
const PLUSH_SLOTS = SPOTS;
/** Away this long (ms) and Pip is asleep on the perch when you come back; `?sleep=1` forces it (filming). */
const SLEEP_AFTER = 3 * 3600 * 1000;
const FORCE_SLEEP = new URLSearchParams(location.search).get('sleep') === '1';
/** `?debug=1`: show frame rate and draw calls on a tag behind the card. */
const DEBUG_HUD = new URLSearchParams(location.search).get('debug') === '1';
/** `?shadows=0`: no real-time shadows (contact shadows stay), for frame-time comparisons on a headset. */
const NO_SHADOWS = new URLSearchParams(location.search).get('shadows') === '0';
/** IWSDK keeps its persistent room anchor's handle here. */
const ANCHOR_KEY = 'iwsdk_scene_anchor_uuid';
/** Seconds after entering in which last session's loom may come back. */
const RESUME_WINDOW_S = 4;
import { loadProgress, saveProgress, workshopUnlocked, type Progress, type SavedLoom } from '../persistence/progress.js';
import { THEMES, highContrast, otherTheme, type Theme, type ThemeId } from '../ui/theme.js';
import { loadSettings, saveSettings, type Settings } from '../persistence/settings.js';
import { clothFromHash, clothLevel } from '../net/share.js';
import { FrameGuard } from './frame-guard.js';
import { occluderState } from '../input/occluders.js';
import { coop, type CoopStatus } from '../net/coop.js';
import { CoopGuest, CoopHost } from '../net/coop-protocol.js';
import { loadFont } from '../ui/fonts.js';

const params = new URLSearchParams(location.search);
const FIXED_DESK = params.get('desk');
/**
 * Where the present of the day may stand: [x on the shelf side (multiplied by -side), z].
 * Beside the basket, in front of it, beyond the lever box: one per day, in turn.
 */
const GIFT_SPOTS: readonly (readonly [number, number])[] = [
  [0.322, 0.17],
  [0.2, 0.25],
  [-0.48, 0.06],
];
/** ?finale=1: play the grand finale shortly after the loom is placed (for filming). */
const FORCE_FINALE = params.get('finale') === '1';
/** ?film=table (any picture id): start there with every earlier picture woven, for recording a moment. */
const START_ALIASES: Record<string, string> = { friends: 'table', night: 'moon', sea: 'fish', ending: 'boat' };
/** ?start=friends (or night, sea, ending, or any picture id; ?film= is the same): jump there for a short visit or a recording. */
const FILM = ((s: string | null) => (s ? (START_ALIASES[s] ?? s) : null))(params.get('start') ?? params.get('film'));

const KNOB_NAMES: Record<number, string> = { 0xe8553e: 'red', 0x1fb3a0: 'teal', 0xf2b632: 'yellow', 0x7b5bb8: 'purple' };

/** Seconds either side of a music beat that count as "on the beat". */
const BEAT_WINDOW = 0.12;

const HINT_TEXT: Record<HintStep, string> = {
  lever: 'Slide it away',
  unlatch: 'Slide it back',
  weft: "Swap Pip's yarn",
  shuttle: 'Slide Pip across',
  undo: 'Pull to undo',
  card: 'Match the next row',
  knots: 'Each lever move unties a knot',
  combo: '', // the aha is a gold ribbon over the card, not a tag
  more: 'Add another lever',
  friendOn: 'Seat a plush on the cushion',
  friendOff: 'Lift the plush off',
  friendSwap: 'Try a plush with other feet',
  none: '',
};

export interface GameDebug {
  phase: string;
  /** Right rows thrown on the music's beat (debug/E2E). */
  onBeat?: number;
  /** The celebration ribbon's text ('' when hidden). */
  banner?: string;
  /** The last card row poked (debug/E2E). */
  cardRow?: number;
  /** Where the quilts hang this session (debug/E2E). */
  wall?: number[];
  /** Where the last carried plush ended up (debug/E2E). */
  lastDrop?: string;
  /** Threads strummed by a fingertip (debug/E2E). */
  strums?: number;
  deskY: number | null;
  deskSource: string | null;
  loomOrigin: number[] | null;
  latched: boolean[];
  shed: number;
  rows: number[];
  shuttleT: number;
  holding: Record<Side, unknown>;
  hover: Record<Side, unknown>;
  plucks: number;
  paused: boolean;
  level: string;
  levelIndex: number;
  flow: string;
  stars: number;
  hint: HintStep;
  theme: ThemeId;
  workshopUnlocked: boolean;
  notice: string;
  anchored: boolean;
  highContrast: boolean;
  bankSide: number;
  plaque: string;
  challenge: boolean;
  degrade: number;
  calibrating: string;
  coop: string;
  /** The ghost hand showed carrying a plush to the desk (debug/E2E). */
  carryDemo?: boolean;
  /** Plushes that said hello to a neighbour set down beside them (debug/E2E). */
  hello?: number;
  /** Wrong rows the loom unpicked by itself (debug/E2E). */
  autoUndo?: number;
  /** The level's name is still a surprise (shown as "?" until the win). */
  nameReveal?: string;
  /** The plush seated on the friend's cushion ('' when none). */
  friend?: string;
  /** The last chapter quilt that sang because it was looked at (debug/E2E). */
  quiltSong?: string;
  /** The last control pressed by looking at it (debug/E2E). */
  lookPressed?: string;
  /** Times Pip was stroked (debug/E2E). */
  pipPetted?: number;
  /** Times Pip waved because the player looked at it (debug/E2E). */
  pipNoticed?: number;
  /** Motion controllers are held (the game wants bare hands). */
  controllers?: boolean;
  /** The last few notices shown (E2E: a notice can come and go between two checks). */
  notices?: string[];
  /** Grand finale: '' | 'weaving' | 'medley' | 'done'. */
  grand?: string;
}

export class GameSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  model!: LoomModel;
  controller!: LoomController;
  view!: LoomView;
  placement!: Placement;
  private hint!: Label;
  private inv = new Matrix4();
  private planeInv = new Matrix4();
  private head = new Vector3();
  private fwd = new Vector3();
  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private tmpQ = new Quaternion();
  /** The loom's pose is saved under the room anchor for this placement. */
  private loomSaved = false;
  /** The loom's own parent before the room anchor takes it. */
  private loomHome: Object3D | null = null;
  /** This session's loom came back from the last one. */
  private resumed = false;
  private medleyOrder: number[] = [];
  /** Finished chapters' quilts, hung on the real wall in front of the seat (world space). */
  private quiltRoot = new Group();
  private quilts = new Map<string, Group>();
  /** Capture only (marketing stills): hide the tutorial tags and the ghost hand. */
  hideHints = false;
  private hintsHidden = false;
  /** The wall the quilts hang on this session: a point straight ahead at the hanging height, its normal and its along-wall direction. */
  private wall: { at: Vector3; n: Vector3; t: Vector3; size: number } | null = null;
  private wallSearchIn = 0;
  /** A just-finished chapter's quilt flies from the shelf to the wall once its finale has played. */
  private quiltFly: { id: string; t: number; from: Vector3; to: Vector3; q0: Quaternion; q1: Quaternion; g: Group } | null = null;
  private quiltFlyIn = -1;
  /**
   * The grand finale (every chapter woven, or ?finale=1): the loom weaves a rose
   * heart by itself, levers and Pip moving on their own, then every plush sings
   * and the credits go by on the ribbon. Counts down once the desk is quiet.
   */
  private grandIn = FORCE_FINALE ? 2.5 : -1;
  private grand: { t: number; next: number; throwAt: number; won: number; round: number; roundAt: number; singAt: number } | null = null;
  private quiltFlyId = '';
  /** Capture-only photo set is up. */
  private photoMode = false;
  private planeYs: number[] = [];
  private bloom = 0;
  private sessionTime = 0;
  private paused = false;
  private debug!: GameDebug;
  private handInputs: Record<Side, HandInput> = {
    left: mkInput(),
    right: mkInput(),
  };
  private firstHand: Side | null = null;
  flow!: LevelFlow;
  private tutor!: Label;
  private hintLever = 0;
  private time = 0;
  private progress!: Progress;
  private notice = '';
  private noticeAt: 'token' | 'nudge' | 'centre' | 'unlock' | 'shelf' = 'token';
  /** The current chapter's pictures on the shelf (finished ones are pokeable plushes). */
  private shelf: ShelfItem[] = [];
  private singUntil = 0;
  /** Seconds until the 'New style unlocked' tag shows (0: none pending). */
  private unlockNoticeIn = 0;
  /** A notice that waits for the moment to pass (e.g. the streak, after the plush lands). */
  private laterNotice = '';
  private laterNoticeIn = 0;
  /** Seconds Pip has been asleep this session; when the visit was last saved. */
  private asleepFor = 0;
  private napArmed = false;
  private seenIn = 60;
  /** Today's key and whether its picture is woven (refreshed on each level load). */
  private today = '';
  private dailyDone = false;
  private dailyVec = new Vector3();
  private phoneVec = new Vector3();
  private cardRowVecs = Array.from({ length: 8 }, () => new Vector3());
  private cardRowUntil = 0;
  /** Lever clicks during a programmatic drop make no sound. */
  private quietLevers = false;
  private undoNotch = 0;
  /** Game time at which each shelf slot's medley turn starts (-1: none). */
  private sparkleAt = new Array(PLUSH_SLOTS).fill(-1);
  /** A chapter was just completed: its finale waits for the last plush to reach the shelf. */
  private finale: { chapter: string; items: ShelfItem[]; level: Level } | null = null;
  private plushVecs = Array.from({ length: PLUSH_SLOTS }, () => new Vector3());
  private keyVec = new Vector3();
  private swapVec = { x: 0, y: 0, z: 0 };
  private tagAt = { x: 0, y: 0, z: 0 };
  /** Tutorial/idle breath on the swap spools (0–1). */
  private swapGlow = 0;
  private tip!: Label;
  /** `?debug=1`: a tag behind the card with frame rate, draw calls and the quality level (for headset testing). */
  private hud: Label | null = null;
  private hudT = 0;
  private hudFrames = 0;
  private hudCalls = 0;
  private banner!: Label;
  private bannerLeft = 0;
  /** The ribbon's own height and how long it shows (the finale's over the shelf, the aha's over the card). */
  private bannerY = 0.13;
  private bannerDur = 6;
  private tipCode = -1;
  private tipHover = 0;
  private tipReady = false;
  private tipShown = false;
  private noticeTimer = 0;
  private tokenPop = 1;
  private loomEntity!: Entity;
  private settings: Settings = loadSettings();
  private guard = new FrameGuard();
  private audioSession: XRSession | null = null;
  private holdRing!: InstancedMesh;
  private tmpM = new Matrix4();
  /** Pause sources are tracked separately so one can't cancel the other. */
  private xrBlurred = false;
  private pageHidden = false;
  private calTime = 0;
  private calibrator: Calibrator | null = null;
  private coopLink: CoopHost | CoopGuest | null = null;
  private coopTransport: unknown = null;
  private pinKey = -1;
  private calSide: Side = 'right';
  /** `?degrade=n` forces a quality level (testing). */
  private forcedDegrade = Number(new URLSearchParams(location.search).get('degrade') ?? NaN);

  /** Theme as displayed (with the high-contrast override applied). */
  private shown(id: ThemeId = this.progress.theme): Theme {
    return this.settings.highContrast ? highContrast(THEMES[id]) : THEMES[id];
  }

  init() {
    this.model = new LoomModel([]);
    this.progress = loadProgress();
    const unlocked = workshopUnlocked(this.progress);
    if (!unlocked) this.progress.theme = 'toy';
    // Soft real-time shadow from the loom's key light (dropped by the frame guard).
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap; // the soft variant costs more per pixel; the map's own blur radius is soft enough
    // (No tone mapping: filmic curves washed the toy palette into pastels.)
    this.view = new LoomView(this.shown());
    if (NO_SHADOWS) this.view.setShadow(false); // `?shadows=0`: compare frame times on the headset
    this.view.plushes.onLand = (at) => {
      audio.hop();
      this.view.fx.ring(at.x, at.y, at.z, 0xfff1d6, at.y > 0.08 ? 0.07 : 0.055); // a soft ring of dust where it lands
    };
    this.view.plushes.onHop = () => audio.pluck(7, 0.6, 0, 0.1);
    this.controller = new LoomController(this.model, {
      pluck: (i, speed) => {
        audio.pluck(i, speed);
        this.view.pluckWarp(i);
        this.debug.plucks++;
      },
      strum: (i, speed) => {
        audio.pluck(i, Math.min(1, 0.15 + speed * 0.8), 0, 0.22);
        this.view.pluckWarp(i);
        this.debug.strums = (this.debug.strums ?? 0) + 1;
      },
      leverClick: (k, latched) => {
        if (this.quietLevers) return;
        audio.click(latched);
        this.view.latchPop(k, latched);
        // the lever strums its own threads (up when lifting, down and softer when dropping): you learn it by ear
        const mask = this.flow?.level.tieUp[k] ?? 0;
        let j = 0;
        for (let n = 0; n < WARPS; n++) {
          const i = latched ? n : WARPS - 1 - n;
          if (!isLifted(mask, i)) continue;
          audio.pluck(i, 0.15, 0.02 + j * 0.028, latched ? 0.09 : 0.055);
          if (latched) this.view.pluckWarp(i);
          j++;
        }
      },
      grab: (t) => {
        audio.resume();
        if (t.kind === 'shuttle') {
          this.view.grabPip();
          audio.pipGrab();
        } else audio.grab();
      },
      pass: () => audio.thud(),
      undo: () => audio.unpick(),
      token: () => this.setTheme(otherTheme(this.progress.theme)),
      skein: (i) => this.pickChapter(i),
      nudge: (dir) => this.nudgeDesk(dir),
      plush: (i) => {
        // with the cushion out a poke seats a plush (or sends the seated one home): no carrying needed
        if (this.flow.level?.friend && this.flow.phase === 'play') {
          const id = this.view.plushes.idAt(i);
          if (i === this.seated) this.sendFriendHome();
          else if (id) {
            if (this.seated >= 0) this.sendFriendHome(); // one friend at a time
            this.seatFriend(this.view.plushes.idAt(i) === id ? i : this.spotOf(id), id);
          }
          return;
        }
        this.singPlush(i);
      },
      carry: (i, p) => {
        // lifting the friend off its cushion: its threads drop
        if (this.seated >= 0 && i === this.seated) this.unseatFriend();
        this.view.plushes.carry(i, p);
      },
      drop: (i, p) => this.dropPlush(i, p),
      windKey: () => this.playShelf(),
      daily: () => this.startDaily(),
      phone: () => this.pokePhone(),
      cardRow: (i) => this.playCardRow(i),
      swap: () => {
        this.model.setWeft(this.model.weft ? 0 : 1);
        audio.swapYarn();
      },
    });
    this.controller.tokenEnabled = unlocked;
    this.view.token.visible = unlocked;
    if (this.progress.theme === 'workshop') this.ensureWorkshopFont();
    audio.tone = THEMES[this.progress.theme].tone;
    audio.setMusic(this.settings.music);
    this.placement = new Placement();

    // In-world tutorial label (child of the loom; faces the user).
    this.tutor = new Label(0.17, 0.036);
    this.tutor.mesh.rotation.x = -0.35;
    // hints are never hidden behind a bowl or a post
    (this.tutor.mesh.material as import('@iwsdk/core').MeshBasicMaterial).depthTest = false;
    this.tutor.mesh.renderOrder = 999; // over the ghost hand too: the words are never hidden by the demo
    this.view.root.add(this.tutor.mesh);
    this.tutor.setTheme(this.shown());
    this.tutor.set('');
    // a small tooltip over whatever secondary control a hand is hovering (what does this do?)
    if (DEBUG_HUD) {
      this.hud = new Label(0.2, 0.03);
      this.hud.mesh.position.set(0, CARD.baseY + 0.16, CARD.z - 0.01);
      this.view.root.add(this.hud.mesh);
    }
    this.tip = new Label(0.13, 0.028);
    this.tip.mesh.rotation.x = -0.35;
    (this.tip.mesh.material as import('@iwsdk/core').MeshBasicMaterial).depthTest = false;
    this.tip.mesh.renderOrder = 21;
    this.view.root.add(this.tip.mesh);
    this.tip.setTheme(this.shown());
    this.tip.set('');
    // a gold ribbon for celebrations (a chapter finished): never mistaken for a hint
    this.banner = new Label(0.3, 0.06);
    this.banner.style = 'ribbon';
    this.banner.mesh.rotation.x = -0.3;
    (this.banner.mesh.material as import('@iwsdk/core').MeshBasicMaterial).depthTest = false;
    this.banner.mesh.renderOrder = 22;
    this.view.root.add(this.banner.mesh);
    this.banner.setTheme(this.shown());
    this.banner.set('');

    const onTheme = (e: Event) => {
      const id = (e as CustomEvent<ThemeId>).detail;
      if (id === 'toy' || (id === 'workshop' && workshopUnlocked(this.progress))) this.setTheme(id);
    };
    window.addEventListener('loomsong:theme', onTheme);
    this.cleanupFuncs.push(() => window.removeEventListener('loomsong:theme', onTheme));
    motion.calm = this.settings.calmMotion ?? prefersReducedMotion();
    const onSettings = () => {
      this.settings = loadSettings();
      motion.calm = this.settings.calmMotion ?? prefersReducedMotion();
      applyCalibration(this.settings.calibration);
      audio.setMusic(this.settings.music);
      this.restyle();
      this.flow.refresh();
    };
    window.addEventListener('loomsong:settings', onSettings);
    const onCoop = (e: Event) => this.onCoop((e as CustomEvent<CoopStatus>).detail);
    window.addEventListener('loomsong:coop', onCoop);
    this.cleanupFuncs.push(() => window.removeEventListener('loomsong:coop', onCoop));
    this.cleanupFuncs.push(() => window.removeEventListener('loomsong:settings', onSettings));

    this.loomEntity = this.world.createTransformEntity(this.view.root);
    this.loomHome = this.view.root.parent;
    this.quiltRoot.name = 'Quilts';
    this.world.createTransformEntity(this.quiltRoot);
    this.quiltRoot.visible = false;
    this.loomEntity.object3D!.visible = false;
    this.world.createTransformEntity(this.view.glows.left);
    this.world.createTransformEntity(this.view.glows.right);

    this.hint = new Label(0.22, 0.034);
    this.hint.set('Rest your hand here');
    this.world.createTransformEntity(this.hint.mesh);
    this.hint.mesh.visible = false;

    // Hold-still progress: 20 dots around the resting palm fill up.
    const dot = new SphereGeometry(0.0035, 8, 6);
    this.holdRing = new InstancedMesh(dot, new MeshBasicMaterial({ color: 0xf2b632 }), HOLD_DOTS);
    this.holdRing.frustumCulled = false;
    this.holdRing.count = 0;
    for (let i = 0; i < HOLD_DOTS; i++) {
      const a = (i / HOLD_DOTS) * Math.PI * 2;
      this.tmpM.makeTranslation(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
      this.holdRing.setMatrixAt(i, this.tmpM);
    }
    this.world.createTransformEntity(this.holdRing);

    this.model.on((e) => {
      if (e.type === 'lever') {
        this.view.setShed(e.shed);
        // First try of a mystery lever: it takes its colour, with a little chime,
        // and the try is free (probing is deduction, not a knot spent)
        if (e.latched && this.view.revealLever(e.lever)) {
          audio.reveal();
          this.model.leverFlips = Math.max(0, this.model.leverFlips - 1);
        }
        this.view.card.setUsed(this.model.leverFlips);
      }
      if (e.type === 'weft') this.view.setWeftNow(e.weft);
      if (e.type === 'friend') this.view.setShed(e.shed); // a seated plush lifts the threads under its feet
      if (e.type === 'row' || e.type === 'undo' || e.type === 'sync') this.view.setRows(this.model.rows);
      // Pip reacts to each row: a happy hop and wink, or a droop.
      if (e.type === 'row' && this.flow?.level) {
        const good = e.row === this.flow.level.target[e.index];
        this.view.setPipMood(good ? 'happy' : 'sad');
        this.view.rowVerdict(good);
        // a wrong row unweaves itself after Pip's droop (the tutorial teaches the spool instead)
        this.autoUndoRow = !good && !this.flow.tutorial ? e.index : -1;
        this.autoUndoAt = this.time + 1.4;
        audio.chirp(good ? 'happy' : 'sad');
        audio.verdict(good);
        // in rhythm: a right row thrown on the music's beat lands with a golden sparkle and a chord
        const off = good ? audio.beatOffset() : null;
        if (off !== null && off < BEAT_WINDOW) {
          audio.onBeat();
          this.view.fx.confetti(0, 0.012, this.view.fellZNow, 26, 0.45, true);
          this.debug.onBeat = (this.debug.onBeat ?? 0) + 1;
        }
      }
    });

    this.flow = new LevelFlow(this.model, levelAt, this.progress, {
      load: (level) => {
        // a new picture arrives: the card springs in, the ghost fades up, Pip hops, a soft bloom
        if (this.placement?.phase === 'placed') {
          this.view.arrive();
          audio.bloom();
        }
        this.controller.syncFromModel();
        this.controller.enabled = true;
        this.view.setActiveLevers(level.tieUp.length);
        // Picture colour on the warps; mystery chapters hide the lever ties
        // until each lever has been tried once.
        this.view.nightCloth = level.chapter === 'night';
        this.view.setPicture(level.color ?? null, level.tieUp, level.tieUp.map(() => !!level.mystery));
        this.view.setTarget(level.target);
        this.view.card.paper = level.chapter === 'night' ? '#b9beea' : null; // Sea stays cream so its blue water rows read
        this.view.card.sparkles = false;
        this.view.card.weft = level.weft ?? null;
        this.view.setWeftColor(level.weft ?? null);
        this.view.card.setPicture(level.color ?? null, level.par);
        // a picture you haven't woven yet keeps its name until it comes alive: "?" on the plate, the name on the win
        this.nameHidden = !!level.chapter && level.id !== 'thanks' && !((this.progress.best[level.id] ?? 0) > 0);
        const plate = this.nameHidden ? '?' : level.name;
        this.view.plaque.set(plate);
        if (this.debug) this.debug.plaque = plate;
        // a new picture: any friend goes home (the shelf and desk are rebuilt below); the cushion shows if this one needs a friend
        this.seated = -1;
        this.view.setFriend(0, 0xffffff);
        this.view.setCushion(!!level.friend);
        if (this.debug) this.debug.friend = '';
        this.shelf = shelfItems(level, this.progress);
        this.view.plushes.setShelf(this.shelf, shelfChapter(level, this.progress)?.name ?? '');
        this.view.plushes.setDesk(deskItems(this.progress));
        // the second picture: show, once, that a plush can be carried off the shelf onto the desk
        this.carryIn = !this.carryShown && this.picturesDone() === 1 && !this.flow?.challenge ? 2.5 : -1;
        this.syncDaily();
        this.syncBasket(level);
        // the very first picture keeps the desk quiet: no shelf, no basket until there's something to show
        const fresh = !this.progress.tutorialDone && !Object.values(this.progress.best).some((v) => v > 0);
        this.view.plushes.showShelf(!fresh);
        // the desk fills as you play: the chapter basket after two pictures (the present and the telephone come later)
        const showBasket = this.picturesDone() >= 2;
        this.view.basket.root.visible = showBasket;
        if (!showBasket) this.controller.skeins = 0;
        this.view.setShed(0, true);
        this.view.setRows(this.model.rows);
        this.view.setGlowRow(-1);
        audio.setRoot(keyFor(level.chapter, level.rootMidi)); // the threads play in the chapter track's key
        audio.setMood(level.chapter ?? 'garden');
        this.view.roomMood.set(this.photoMode ? undefined : level.chapter);
        if (this.debug) {
          this.debug.level = level.id;
          this.debug.levelIndex = this.flow?.index ?? 0;
        }
      },
      status: (level, statuses, stars) => {
        // the loom's own thank-you isn't scored
        this.view.card.draw(level.name, level.target, statuses, level.id === 'thanks' ? 0 : stars, this.settings.highContrast);
        this.view.placeCard();
      },
      win: (stars) => {
        this.controller.enabled = false;
        // the punchline: the plate turns over to the picture's name as it comes alive
        if (this.nameHidden) {
          this.nameHidden = false;
          const name = this.flow.level.name;
          this.view.plaque.set(name);
          this.debug.plaque = name;
          this.debug.nameReveal = name;
          audio.reveal();
          // its name on a felt ribbon over the dancing plush (the plate is tucked away while it dances)
          this.bannerAt(name, PLUSH.stageX, PLUSH.danceY + 0.14, PLUSH.stageZ - 0.03, 3.6); // above its head (never across its face), for most of the dance
        }
        this.view.setPipMood('cheer');
        // felt confetti from both sides of the plush, out and away (the card and its stars stay clear)
        this.view.fx.confetti(-0.09, 0.04, LOOM.clothFrontZ + 0.02, 22, 1.05);
        this.view.fx.confetti(0.09, 0.04, LOOM.clothFrontZ + 0.02, 22, 1.05);
        audio.chirp('cheer');
        // It comes alive: the woven picture pops out as a plush.
        const lv = this.flow.level;
        const songEnd = TIMING.winPause + lv.target.length * TIMING.rowTime;
        if (this.grand) {
          // the thank-you heart stays on the loom: after its song, every plush sings in turn
          this.grand.won = this.grand.t;
          this.grand.roundAt = this.grand.t + songEnd + 0.6;
          this.flow.extraBetween = this.grandMedleySecs() + 1.5;
        } else {
          this.view.plushes.celebrate(lv.id, lv.target, lv.color ?? this.shown().palette.weft, this.heroSpot(lv), (this.progress.best[lv.id] ?? 0) >= 3);
          if (!this.view.plushes.shelfShown) this.view.plushes.showShelf(true, true); // the shelf springs up for the first plush
          // the next picture waits for the whole show: pop, dance (at least PLUSH.minDance), bow, hop
          const showEnd = Math.max(songEnd, 0.95 + PLUSH.minDance) + 0.8 + 0.75;
          this.flow.extraBetween = Math.max(0, showEnd + 0.3 - (songEnd + TIMING.afterPlayback));
        }
        // the very first gold bow: say what it's for, once the plush has landed
        if (stars >= 3 && Object.values(this.progress.best).filter((b) => b >= 3).length === 1) {
          this.laterNotice = 'Fewest moves: a gold bow!';
          this.laterNoticeIn = 4.6;
        }
        // a friend helped: it sings along with the new plush, and gets a thank-you
        if (this.seated >= 0) {
          const fid = this.view.plushes.idAt(this.seated);
          const fpic = fid ? pictureById(fid) : null;
          if (fpic) {
            this.view.plushes.sing(this.seated, 2.4, 1.2);
            this.laterNotice = `Thanks, ${fpic.name}!`;
            this.laterNoticeIn = 4.6;
          }
        }
        if (this.flow.daily) {
          // today's picture joins the streak; say so once the plush has hopped onto the desk
          const n = streakOf(this.progress.days ?? [], this.flow.daily);
          this.laterNotice = n >= 2 ? `${n} days in a row!` : 'A new picture tomorrow';
          this.laterNoticeIn = 4.6;
          this.syncDaily();
        }
        this.controller.releaseAll();
        // the levers drop back to rest with a clack as the picture comes alive (not a move: flips restored)
        const flips = this.model.leverFlips;
        this.quietLevers = true; // a silent drop: the win has its own sounds
        for (let k = 0; k < LEVERS; k++) this.controller.applyLatched(k, false);
        this.quietLevers = false;
        this.model.leverFlips = flips;
        audio.arpeggio();
        // the win song plays alone: music rests until the plush is on the shelf
        audio.holdMusic(TIMING.winPause + lv.target.length * TIMING.rowTime + TIMING.afterPlayback);
        this.view.pulseWarp();
        if (this.debug) this.debug.stars = stars;
        if (!this.controller.tokenEnabled && workshopUnlocked(this.progress)) this.revealWorkshop();
        // the last picture of a chapter: once its plush is on the shelf, the whole shelf celebrates
        if (!this.flow.challenge && lv.chapter) {
          const items = shelfItems(lv, this.progress);
          const ch = CHAPTERS.find((c) => c.id === lv.chapter);
          if (ch) this.view.plushes.setTag(`${ch.name} ${items.filter((it) => it.done).length}/${items.length}`);
          if (items.length > 1 && items.every((it) => it.done)) {
            this.finale = { chapter: CHAPTERS.find((c) => c.id === lv.chapter)?.name ?? '', items, level: lv };
            let secs = 1.6;
            for (const it of items) secs += it.rows.length * ROW_BEAT + 0.35;
            this.flow.extraBetween += secs;
          }
        }
        window.dispatchEvent(new CustomEvent('loomsong:cloth'));
        // A finished challenge shouldn't restart on the next reload.
        if (this.flow.challenge && location.hash) {
          try {
            history.replaceState(null, '', location.pathname + location.search);
          } catch {
            /* ignore */
          }
        }
      },
      pluck: (i, delay) => {
        audio.pluck(i, 0.35, delay, 0.26);
        setTimeout(() => this.view.pluckWarp(i), delay * 1000);
      },
      glowRow: (r) => {
        this.view.setGlowRow(r);
        if (r >= 0) this.view.singRow(r); // the cloth sings: notes float up off the row
        // The plush dances a beat per row, then hops up to the shelf.
        if (r >= 0) this.view.plushes.beat();
        else this.view.plushes.finish();
      },
      hint: (step, lever) => {
        // the aha lands with a bright chord and a burst of gold over the threads
        if (step === 'combo') {
          // a moment, not another tag: a gold ribbon over the card, a chord, gold over the threads
          audio.onBeat();
          audio.arpeggio();
          this.view.fx.confetti(0, LOOM.liftedY, LOOM.heddleZ + 0.02, 60, 0.6, true);
          this.view.pulseWarp();
          this.banner.set('Two levers at once!');
          this.banner.mesh.position.set(0, CARD.baseY + this.view.card.heightM + 0.075, CARD.z + 0.01); // above the card, never over the picture
          this.banner.mesh.visible = true;
          this.bannerLeft = this.bannerDur = TIMING.comboHint + 0.4;
          this.bannerY = this.banner.mesh.position.y;
          this.debug.banner = 'Two levers at once!';
        }
        this.hintLever = lever;
        this.tutor.set(this.hintText(step));
        if (this.debug) this.debug.hint = step;
      },
      save: (p) => saveProgress(p),
      totals: () => {
        // the plate names the picture on the loom (set on load); totals stay in progress
      },
    });

    this.debug = {
      phase: 'waiting',
      deskY: null,
      deskSource: null,
      loomOrigin: null,
      latched: this.model.latched,
      shed: 0,
      rows: this.model.rows,
      shuttleT: 0,
      holding: this.controller.holding,
      hover: this.controller.hover,
      plucks: 0,
      paused: false,
      level: '',
      levelIndex: 0,
      flow: 'play',
      stars: 0,
      hint: 'none',
      theme: this.progress.theme,
      workshopUnlocked: unlocked,
      notice: '',
      anchored: false,
      highContrast: this.settings.highContrast,
      bankSide: 1,
      plaque: '',
      challenge: false,
      degrade: 0,
      calibrating: '',
      coop: 'solo',
    };
    applyCalibration(this.settings.calibration);
    const shared = clothFromHash(location.hash);
    const film = FILM ? LEVELS.findIndex((l) => l.id === FILM) : -1;
    if (shared) this.flow.startChallenge(clothLevel(shared));
    else if (film > 0) {
      // ?film=<picture>: every picture before it woven (their plushes on the shelves), that one on the loom
      for (let i = 0; i < film; i++) this.progress.best[LEVELS[i].id] ??= 2;
      this.progress.tutorialDone = true;
      this.progress.level = film;
      saveProgress(this.progress);
      this.flow.start(film);
    } else this.flow.start();
    this.debug.challenge = this.flow.challenge;
    (window as unknown as { __loom: unknown }).__loom = {
      debug: this.debug,
      game: this,
      coop,
      hands,
      audio,
      /** World positions of interactables, for E2E scripts. */
      targets: () => this.targets(),
      /** Capture-only photo set (desk + warm backdrop) for marketing shots. */
      photo: (on: boolean) => {
        this.view.photoSet(on);
        this.photoMode = on; // the photo backdrop hides the room's walls: no quilts in marketing shots
      },
    };

    this.cleanupFuncs.push(
      this.visibilityState.subscribe((s) => {
        this.xrBlurred = s === VisibilityState.VisibleBlurred || s === VisibilityState.Hidden;
        this.setPaused(this.xrBlurred || this.pageHidden);
        if (s === VisibilityState.Visible) {
          const sess = this.world.session;
          // XR select events carry user activation: use them to unlock audio.
          if (sess && sess !== this.audioSession) {
            this.audioSession = sess;
            sess.addEventListener('selectstart', () => audio.resume());
            sess.addEventListener('squeezestart', () => audio.resume());
          }
          if (sess?.updateTargetFrameRate && sess.supportedFrameRates?.includes(72)) {
            sess.updateTargetFrameRate(72).catch(() => {});
          }
        }
        if (s === VisibilityState.NonImmersive) this.endSession();
      }),
    );
    const onVis = () => {
      this.pageHidden = document.visibilityState === 'hidden';
      this.setPaused(this.xrBlurred || this.pageHidden);
    };
    document.addEventListener('visibilitychange', onVis);
    this.cleanupFuncs.push(() => document.removeEventListener('visibilitychange', onVis));
  }

  /** Switch the visual theme (Workshop only once unlocked). */
  setTheme(id: ThemeId): void {
    if (id === 'workshop' && !workshopUnlocked(this.progress)) return;
    this.progress.theme = id;
    saveProgress(this.progress);
    this.restyle();
    audio.restyle();
    this.view.pulseWarp();
    this.tokenPop = 0;
    this.debug.theme = id;
    if (this.notice) this.showNotice('', 0);
    if (id === 'workshop') this.ensureWorkshopFont();
  }

  /** Degrade gracefully when frames are missed (spec §6). */
  private watchFrames(delta: number): void {
    if (this.hud) {
      this.hudT += delta;
      this.hudFrames++;
      this.hudCalls += this.renderer.info.render.calls;
      if (this.hudT >= 0.5) {
        const fps = Math.round(this.hudFrames / this.hudT);
        const calls = Math.round(this.hudCalls / this.hudFrames);
        this.hud.set(`${fps} fps · ${calls} draws · q${this.debug.degrade}`);
        this.hudT = 0;
        this.hudFrames = 0;
        this.hudCalls = 0;
      }
    }
    const sess = this.world.session;
    if (!sess) return;
    const hz = sess.frameRate ?? 72;
    const forced = Number.isFinite(this.forcedDegrade) ? this.forcedDegrade : null;
    const lvl = forced ?? this.guard.sample(delta, hz);
    if (lvl === null || lvl === this.debug.degrade) return;
    this.debug.degrade = lvl;
    audio.setReverb(lvl < 1);
    this.view.setShadow(lvl < 1 && !NO_SHADOWS);
    this.view.roomMood.enabled = lvl < 1; // the room veil and ripples cost fill: first to go
    occluderState.enabled = lvl < 2; // spec §6: drop occluders under load
    try {
      this.renderer.xr.setFoveation(lvl >= 2 ? 1 : 0.5);
    } catch {
      /* foveation unsupported */
    }
  }

  /** Apply the current theme + high-contrast setting to every surface. */
  private restyle(): void {
    const theme = this.shown();
    this.debug.highContrast = this.settings.highContrast;
    this.view.setTheme(theme);
    this.tutor.setTheme(theme);
    this.tip?.setTheme(theme);
    this.banner?.setTheme(theme);
    audio.tone = theme.tone;
  }

  /** Fraunces loads on demand; restyle text once it arrives. */
  private ensureWorkshopFont(): void {
    void loadFont('Fraunces', 4000).then((ok) => {
      if (!ok || this.progress.theme !== 'workshop') return;
      const theme = this.shown('workshop');
      this.view.card.setTheme(theme);
      this.view.plaque.setTheme(theme);
      this.tutor.setTheme(theme);
    this.tip?.setTheme(theme);
    this.banner?.setTheme(theme);
    });
  }

  /** First unlock: the token pops up with a short notice. */
  private revealWorkshop(): void {
    this.controller.tokenEnabled = true;
    this.view.token.visible = true;
    this.tokenPop = 0;
    this.debug.workshopUnlocked = true;
    this.unlockNoticeIn = 4.2; // once the plush has danced and hopped to the shelf: one moment at a time
    void loadFont('Fraunces', 4000); // warm the cache before the first switch
    window.dispatchEvent(new CustomEvent('loomsong:unlocked'));
  }

  /** Co-op connected / left: switch roles and the authority model. */
  private onCoop(st: CoopStatus): void {
    const side = { model: this.model, controller: this.controller, flow: this.flow };
    // a call from the toy telephone didn't get through: say so, and how to try again
    if (st.state === 'error' && this.view.phone.phoneState === 'calling') {
      this.showNotice('The line is busy: poke the telephone to try again', 7, 'centre');
    }
    // the toy telephone's tag: the code while it waits for the caller
    const hosting = st.role === 'host' && (st.state === 'hosting' || st.state === 'connected');
    if (!hosting) this.view.phone.setState('idle');
    // the code shows once the line is open (before that a friend couldn't join with it yet)
    else if (this.view.phone.phoneState !== 'connected' || st.state === 'hosting') this.view.phone.setState('calling', st.state === 'hosting' && st.message !== 'Waiting for a friend' ? '…' : (st.code ?? ''));
    // Any state change other than a fresh connection ends the current link.
    if (this.coopLink && (st.state !== 'connected' || coop.transport !== this.coopTransport)) {
      this.endCoop(st.state === 'closed' || st.state === 'error');
    }
    // a phone caller runs its own 2D view (ui/caller.ts), not a mirrored loom
    if (st.role === 'caller') return;
    if (st.state === 'connected' && coop.transport && !this.coopLink) {
      this.coopTransport = coop.transport;
      this.coopLink = st.role === 'host' ? new CoopHost(side, coop.transport) : new CoopGuest(side, coop.transport);
      this.debug.coop = st.role ?? 'solo';
      if (this.coopLink instanceof CoopHost) {
        this.coopLink.onCaller = () => {
          this.debug.coop = 'host+caller';
          this.view.phone.setState('connected');
          this.setCallerGap(true);
          this.showNotice('Your caller has the picture: ask them!', 6, 'centre');
        };
        // the caller pins threads (a tap on a square) and rings Pip
        this.coopLink.onPin = (i, on) => {
          this.view.pinThread(i, on);
          if (on) audio.pluck(i, 0.5, 0, 0.26, panOf(warpX(i)));
        };
        this.coopLink.onRing = () => {
          if (this.view.pipAsleep) this.view.wakePip();
          this.view.setPipMood('wave');
          audio.chirp('happy');
          this.showNotice('Your caller says hello', 3, 'centre');
        };
      }
      if (this.placement.phase === 'placed') {
        // a host learns who joined from their hello (a phone caller says so at once)
        if (st.role !== 'host') this.showNotice('You throw the shuttle', 6, 'centre');
      }
    }
  }

  /** Caller co-op information gap: the picture leaves the headset (card and ghost); the phone has it. */
  private setCallerGap(on: boolean): void {
    this.view.card.secret = on;
    this.view.setTargetHidden(on);
    this.flow.quiet = on;
    if (on) this.flow.tutorial = false;
    this.flow.refresh();
  }

  private endCoop(announce: boolean): void {
    const link = this.coopLink;
    if (!link) return;
    if (link instanceof CoopHost && link.caller) this.setCallerGap(false);
    this.view.clearPins();
    const wasGuest = link instanceof CoopGuest;
    if (link instanceof CoopHost) link.dispose();
    this.coopLink = null;
    this.coopTransport = null;
    this.controller.allow = { levers: true, shuttle: true };
    this.controller.mirror = false;
    this.controller.hooks.request = undefined;
    this.flow.mirror = false;
    if (wasGuest) this.flow.start(); // back to your own progress
    this.debug.coop = 'solo';
    if (announce && this.placement.phase === 'placed') this.showNotice('Back to solo', 4, 'centre');
  }

  /** "Fit to my hands": pinch ×3, then hold still 2 s (≤ 20 s total). */
  private startCalibration(hand: Side): void {
    // One attempt per request: never trap a player in a calibration loop.
    this.settings = { ...this.settings, calibrateNext: false };
    saveSettings(this.settings);
    this.calTime = 0;
    this.calibrator = new Calibrator();
    this.calSide = hand;
    this.controller.enabled = false;
    this.setCalText();
  }

  private updateCalibration(dt: number): void {
    const cal = this.calibrator!;
    // Use whichever hand is tracked, preferring the one that set the table.
    const side: Side = hands[this.calSide].tracked ? this.calSide : this.calSide === 'left' ? 'right' : 'left';
    const h = hands[side];
    for (const s of ['left', 'right'] as const) this.fillInput(s); // glow + highlights
    this.calTime += dt;
    if (this.calTime > 20) {
      // Timed out: keep the defaults and let them play.
      this.calibrator = null;
      this.controller.enabled = this.flow.phase === 'play';
      this.debug.calibrating = 'skipped';
      this.showNotice('Using standard settings', 3, 'centre');
      return;
    }
    const before = `${cal.step}${cal.pinches}`;
    cal.update(h.tracked ? h.pinchDist : null, h.tracked ? h.rawPinch : null, dt);
    if (`${cal.step}${cal.pinches}` !== before) {
      audio.click(true);
      this.setCalText();
    }
    if (cal.step === 'done' && cal.result) {
      this.settings = { ...this.settings, calibrateNext: false, calibration: cal.result };
      saveSettings(this.settings);
      applyCalibration(cal.result);
      this.calibrator = null;
      this.controller.enabled = this.flow.phase === 'play';
      this.debug.calibrating = 'done';
      this.showNotice('All set', 2.5);
      audio.arpeggio();
    }
  }

  private setCalText(): void {
    const cal = this.calibrator!;
    const text =
      cal.step === 'pinches'
        ? ['Pinch 3 times, palm down', 'Two more', 'One more'][Math.min(cal.pinches, 2)]
        : 'Hold your pinch still';
    this.debug.calibrating = `${cal.step}:${cal.pinches}`;
    this.notice = text;
    this.noticeTimer = 999;
    this.noticeAt = 'centre';
    this.debug.notice = text;
    this.tutor.set(text);
  }

  /** XR session ended: drop the anchor and re-run "set the table" next time. */
  private endSession(): void {
    this.sessionTime = 0;
    this.wall = null;
    this.quiltRoot.visible = false;
    this.quiltFly = null;
    if (this.calibrator) {
      this.calibrator = null;
      this.debug.calibrating = '';
    }
    if (this.notice) this.showNotice('', 0);
    this.controller.enabled = this.flow.phase === 'play';
    if (!this.placement || this.placement.phase !== 'placed') return;
    if (this.loomEntity.hasComponent(XRAnchor)) this.loomEntity.removeComponent(XRAnchor);
    this.placement = new Placement();
    this.view.root.visible = false;
    this.controller.nudgeEnabled = false;
    this.view.nudges.visible = false;
    this.debug.phase = 'waiting';
    this.debug.anchored = false;
  }

  /** Default placement: move the loom up/down to meet the real desk. */
  private nudgeDesk(dir: 1 | -1): void {
    const y = (this.placement.deskY ?? this.view.root.position.y) + dir * NUDGE.step;
    this.placement.deskY = y;
    // Parent may be IWSDK's anchor group (≈ identity), so move in local space.
    this.view.root.position.y += dir * NUDGE.step;
    this.view.root.updateMatrixWorld(true);
    this.loomSaved = false;
    this.debug.deskY = y;
    this.debug.loomOrigin = this.view.root.position.toArray().map((n) => Math.round(n * 1e4) / 1e4);
    audio.click(dir > 0);
  }

  /** The ghost hand demonstrates the current tutorial gesture on the real target. */
  /** The tag's words: levers by number and colour ("Lift lever 1 (red)"); in the tutorial the card hint states the goal once. */
  private hintText(step: HintStep): string {
    if (step === 'card' && this.flow?.tutorial) return 'Weave each row like the card';
    const look = !!this.settings.lookToPlay;
    if (step === 'lever' || step === 'unlatch') {
      const name = this.leverName(this.hintLever);
      if (look) return `Look at ${name}`;
      return step === 'lever' ? `Lift ${name}` : `Put ${name} back`;
    }
    if (look && step === 'shuttle') return 'Look at Pip';
    if (look && step === 'undo') return 'Look at the spool to undo';
    if (look && step === 'weft') return 'Look at the yarn balls';
    if (look && step === 'friendOn') return 'Look at a plush to seat it';
    if (look && step === 'friendOff') return 'Look at the plush to lift it off';
    return HINT_TEXT[step];
  }

  /** A lever's spoken name: its knob colour, or its place when colours don't tell them apart (brass, mystery). */
  /** "lever 1 (red)": the number matches the dots on the lever box, the colour the knob (none when knobs share a colour or are undyed). */
  private leverName(k: number): string {
    const knobs = this.shown().palette.knobs;
    const same = knobs.every((c) => c === knobs[0]);
    const colour = same || this.flow?.level?.mystery ? '' : KNOB_NAMES[knobs[k]] ?? '';
    return colour ? `lever ${k + 1} (${colour})` : `lever ${k + 1}`;
  }

  private syncGhost(dt: number, step: HintStep): void {
    const ghost = this.view.ghost;
    if (!ghost.ready) {
      const ad = (this.world.input as unknown as { visualAdapters?: { hand?: { right?: { visual?: { model?: import("@iwsdk/core").Object3D } } } } }).visualAdapters;
      const m = ad?.hand?.right?.visual?.model;
      if (m) ghost.attach(m);
    }
    const c = this.controller;
    const side = c.bankSide;
    // once, early on: the ghost hand lifts the first plush off the shelf and sets it on the desk (no words)
    if (this.carryIn > 0 && this.placement.phase === 'placed' && this.flow.phase === 'play') {
      this.carryIn -= dt;
      if (this.carryIn <= 0) this.startCarryDemo();
    }
    if (this.carryDemo > 0) {
      this.carryDemo -= dt;
      const busyNow = c.holding.left !== null || c.holding.right !== null;
      if (busyNow || this.flow.phase !== 'play' || Object.keys(this.progress.placed ?? {}).length > 0) this.carryDemo = 0;
    }
    ghost.show(
      this.settings.lookToPlay
        ? null // no hands to show: the felt dot on what you look at is the guide
        : this.carryDemo > 0 && this.carryGesture
        ? this.carryGesture
        : this.notice
        ? null
        : step === 'lever' || step === 'unlatch'
          ? { kind: 'lever', k: this.hintLever, back: step === 'unlatch' }
          : step === 'shuttle'
            ? { kind: 'shuttle', fromEnd: c.shuttle.t < 0.5 ? 0 : 1 }
            : null,
      side,
    );
    const busy = c.hover.left !== null || c.hover.right !== null || c.holding.left !== null || c.holding.right !== null;
    ghost.update(dt, busy);
  }

  /** The carry demo: seconds left, and its path (from the first shelf plush to a free desk spot). */
  private carryDemo = 0;
  private carryShown = false;
  private carryIn = -1;
  private carryGesture: import('../loom/ghost-hand.js').GhostGesture = null;
  private startCarryDemo(): void {
    if (this.carryShown || Object.keys(this.progress.placed ?? {}).length > 0 || this.coopLink) return;
    let i = -1;
    for (let k = 0; k < PLUSH.slots; k++) if (this.view.plushes.idAt(k)) i = i < 0 ? k : i;
    // a short carry: off the shelf to the open desk just in front of it (the basket and present aren't out yet)
    const side = this.controller.bankSide;
    const to: [number, number] = [-side * (PLUSH.shelfX - 0.05), PLUSH.shelfZ + 0.15];
    if (i < 0 || !this.view.plushes.plushCentre(i, this.tmp2)) return;
    this.carryShown = true;
    this.carryGesture = { kind: 'carry', ax: this.tmp2.x, ay: this.tmp2.y, az: this.tmp2.z, bx: to[0], by: 0.03, bz: to[1] };
    this.carryDemo = 5.2; // two passes of the gesture
    this.debug.carryDemo = true;
  }

  /** Schedule a picture's song `delay` s from now (a row per hop, rows alternating like the weaving); returns its length. */
  private schedulePictureSong(rows: readonly number[], delay: number, pan?: number): number {
    for (let r = 0; r < rows.length; r++) {
      const ltr = r % 2 === 0;
      let k = 0;
      for (let j = 0; j < WARPS; j++) {
        const w = ltr ? j : WARPS - 1 - j;
        // a plush sings from where it stands (a little spread around it)
        const p = pan === undefined ? undefined : pan + ((w - (WARPS - 1) / 2) / (WARPS - 1)) * 0.15;
        if (isLifted(rows[r], w)) audio.pluck(w, 0.35, delay + r * ROW_BEAT + k++ * 0.045, 0.24, p);
      }
    }
    return rows.length * ROW_BEAT + 0.15;
  }

  /** A shelf plush was poked: it sings its picture. */
  private singPlush(i: number): void {
    const id = this.view.plushes.idAt(i);
    const lv = id ? pictureById(id) : undefined;
    if (!lv || this.time < this.singUntil) return;
    audio.resume();
    const at = this.view.plushes.plushCentre(i, this.tmp2);
    const secs = this.schedulePictureSong(lv.target, 0, at ? panOf(at.x) : undefined);
    this.singUntil = this.time + secs;
    audio.holdMusic(secs + 0.3);
    this.view.plushes.sing(i, secs);
    this.view.setPipMood('happy');
  }

  /** Chapter complete: the key winds itself, the shelf plays the whole chapter, confetti over it. */
  private playFinale(): void {
    const f = this.finale;
    if (!f) return;
    this.finale = null;
    this.shelf = f.items;
    this.view.plushes.setShelf(f.items, f.chapter); // the tag now reads 4/4
    this.singUntil = 0;
    this.playShelf();
    const side = this.controller.bankSide;
    this.view.fx.confetti(-side * PLUSH.shelfX, PLUSH.shelfTopY + 0.03, PLUSH.shelfZ, 140, 0.8);
    audio.chirp('cheer');
    audio.chapterJingle();
    this.banner.set(`${f.chapter} complete!`);
    this.banner.mesh.position.set(-this.controller.bankSide * PLUSH.shelfX, 0.13, PLUSH.shelfZ);
    this.banner.mesh.visible = true;
    this.bannerLeft = this.bannerDur = 6;
    this.bannerY = 0.13;
    this.debug.banner = `${f.chapter} complete!`;
    // after the medley, the chapter's pictures, sewn into a quilt, fly to the wall
    if (f.level.chapter) {
      this.quiltFlyId = f.level.chapter;
      this.quiltFlyIn = Math.max(0, this.singUntil - this.time) + 0.4;
    }
    // that was the last chapter: once the quilt is up, the loom says thank you
    if (!this.progress.grandSeen && LEVELS.every((l) => (this.progress.best[l.id] ?? 0) > 0)) this.grandIn = 2;
  }

  /** The loom's thank-you: it weaves a rose heart by itself. */
  private startGrand(): void {
    this.grandIn = -1;
    this.grand = { t: 0, next: 1.6, throwAt: -1, won: -1, round: 0, roundAt: -1, singAt: -1 };
    if (!FORCE_FINALE) {
      this.progress.grandSeen = true; // once: replaying a chapter later doesn't bring it back
      saveProgress(this.progress);
    }
    this.controller.releaseAll();
    this.controller.allow = { levers: false, shuttle: false }; // hands rest: the loom plays itself
    this.flow.startChallenge(THANKS_LEVEL);
    this.view.plaque.set('Thank you');
    if (this.debug) {
      this.debug.plaque = 'Thank you';
      this.debug.grand = 'weaving';
    }
    this.view.setPipMood('happy');
    audio.chapterJingle();
    this.bannerAt('Every picture woven!', 0, CARD.baseY + this.view.card.heightM + 0.075, CARD.z + 0.01, 5);
  }

  /** How long the grand medley runs: every finished plush, chapter by chapter, plus the desk. */
  private grandMedleySecs(): number {
    let secs = 0;
    for (const ch of CHAPTERS) {
      secs += 0.6 + 0.55 + 0.5;
      for (const it of chapterShelf(ch, this.progress)) if (it.done && !it.placed) secs += it.rows.length * ROW_BEAT + 0.2;
    }
    for (const it of deskItems(this.progress)) if (it) secs += it.rows.length * ROW_BEAT + 0.2;
    return secs;
  }

  /** A felt ribbon with `text` at (x, y, z) in loom space, for `secs`. */
  private bannerAt(text: string, x: number, y: number, z: number, secs: number): void {
    this.banner.set(text);
    this.banner.mesh.position.set(x, y, z);
    this.banner.mesh.visible = true;
    this.bannerLeft = this.bannerDur = secs;
    this.bannerY = y;
    this.debug.banner = text;
  }

  private static readonly CREDITS = ['Woven by you', 'Music by Scott Buckley', 'Every plush is yours to keep', 'See you tomorrow'];

  private updateGrand(dt: number): void {
    if (this.grandIn > 0 && !this.grand) {
      // wait for a quiet desk: a fresh picture up, nothing flying or singing
      // nobody mid-row, no picture of the day on the loom, no call open or ringing
      const quiet = this.flow.phase === 'play' && !this.finale && !this.quiltFly && this.quiltFlyIn < 0 && !this.view.plushes.busy && this.time >= this.singUntil && !this.coopLink && coop.status.state !== 'hosting' && coop.status.state !== 'connected' && !this.flow.daily && !this.flow.challenge && this.model.rows.length === 0;
      if (quiet) {
        this.grandIn -= dt;
        if (this.grandIn <= 0) this.startGrand();
      }
      return;
    }
    const g = this.grand;
    if (!g) return;
    g.t += dt;
    const c = this.controller;
    // watchdog: if anything took the loom off the thank-you before it was woven (a call, a skein),
    // end the finale and give the hands back rather than weave someone's own picture for them
    if (g.won < 0 && (!this.flow.challenge || this.flow.level !== THANKS_LEVEL)) {
      this.endGrand();
      return;
    }
    if (this.flow.phase === 'play' && g.won < 0) {
      if (g.throwAt >= 0 && g.t >= g.throwAt) {
        g.throwAt = -1;
        c.throwShuttle();
        g.next = g.t + 1.3;
      } else if (g.throwAt < 0 && g.t >= g.next && !c.autoThrow && !c.shuttle.held) {
        // the levers for the next row move by themselves, then Pip flies
        const lv = this.flow.level;
        const want = (lv.target[this.model.rows.length] ?? 0) & 255;
        const n = lv.tieUp.length;
        // the fewest levers that make the row (the loom shows off a clean weave)
        let pick = 0;
        let best = 99;
        for (let m = 0; m < 1 << n; m++) {
          let sh = 0;
          let cnt = 0;
          for (let k = 0; k < n; k++) if ((m >> k) & 1) (sh |= lv.tieUp[k]), cnt++;
          if ((sh & 255) === want && cnt < best) {
            pick = m;
            best = cnt;
          }
        }
        for (let k = 0; k < n; k++) c.applyLatched(k, ((pick >> k) & 1) === 1);
        g.throwAt = g.t + 0.6;
      }
      return;
    }
    if (g.won < 0) return;
    // the heart is woven and sung: then each chapter's shelf in turn springs up and sings
    // (the key winds each time), a credit on the ribbon and felt confetti with each
    if (g.roundAt >= 0 && g.t >= g.roundAt) {
      g.roundAt = -1;
      const r = g.round;
      const ch = CHAPTERS[r];
      if (ch) {
        const items = chapterShelf(ch, this.progress);
        this.view.plushes.showShelf(false);
        this.view.plushes.setShelf(items, ch.name);
        this.view.plushes.showShelf(true, true);
        const side = -this.controller.bankSide;
        this.bannerAt(GameSystem.CREDITS[r] ?? '', 0, CARD.baseY + this.view.card.heightM + 0.075, CARD.z + 0.01, 3.4); // one at a time, above the card
        this.view.fx.confetti(side * PLUSH.shelfX, PLUSH.shelfTopY + 0.05, PLUSH.shelfZ, 50, 0.8);
        this.view.setPipMood('cheer');
        audio.chirp('cheer');
        g.singAt = g.t + 0.6;
        if (this.debug) this.debug.grand = `medley ${ch.id}`;
      }
    }
    if (g.singAt >= 0 && g.t >= g.singAt) {
      g.singAt = -1;
      this.singUntil = 0;
      const last = g.round >= CHAPTERS.length - 1;
      this.playShelf(!last); // the last round brings in the desk plushes too
      g.round++;
      if (!last) g.roundAt = g.t + Math.max(0, this.singUntil - this.time) + 0.5;
    }
    // done once the next picture is up
    if (this.flow.phase === 'play' && !this.flow.challenge) this.endGrand();
  }

  private endGrand(): void {
    this.grand = null;
    this.controller.allow = { levers: true, shuttle: true };
    if (this.debug) this.debug.grand = 'done';
  }

  /** The wind-up key: every finished plush on the shelf sings in turn, left to right (the shelf is a music box). */
  private playShelf(shelfOnly = false): void {
    if (this.time < this.singUntil) return;
    audio.resume();
    audio.windUp();
    let t = 0.55; // after the winding clicks
    // every plush plays, shelf and desk alike, left to right as they stand: arranging them composes the tune
    const order = this.medleyOrder;
    order.length = 0;
    for (let i = 0; i < (shelfOnly ? PLUSH.slots : SPOTS); i++) if (this.view.plushes.idAt(i) && this.view.plushes.plushCentre(i, this.plushVecs[i])) order.push(i);
    order.sort((a, b) => this.plushVecs[a].x - this.plushVecs[b].x);
    for (const i of order) {
      const lv = pictureById(this.view.plushes.idAt(i) ?? '');
      if (!lv) continue;
      const secs = this.schedulePictureSong(lv.target, t, panOf(this.plushVecs[i].x));
      this.view.plushes.sing(i, secs, t);
      this.sparkleAt[i] = this.time + t; // a gold sparkle over each plush as its turn starts
      t += secs + 0.2;
    }
    const total = t;
    this.view.plushes.turnKey(total);
    this.singUntil = this.time + total;
    audio.holdMusic(total + 0.3);
    this.view.setPipMood(total > 0.6 ? 'happy' : 'sad');
  }

  /**
   * Chapter quilts on the real wall. Every second until one is found, look for
   * a vertical plane straight ahead of the seat (0.4–4 m, facing the player);
   * hang each finished chapter's quilt there side by side, a little above eye
   * height. A chapter finished now flies over from the shelf. No wall in the
   * room data: no quilts this session (nothing floats in the air).
   */
  /**
   * The room sings back: look at a chapter's quilt on your wall for a moment and that
   * chapter's pictures play, one after another, while the quilt breathes.
   */
  private gazeId = '';
  private gazeT = 0;
  private quiltSongUntil = new Map<string, number>();
  private swayQuilt: Group | null = null;
  private swayLeft = 0;
  private gazeFwd = new Vector3();
  private gazeQ = new Quaternion();
  private gazeQuilts(dt: number): void {
    // the singing quilt breathes
    if (this.swayQuilt) {
      this.swayLeft -= dt;
      const base = (this.swayQuilt.userData.baseScale as number | undefined) ?? 1;
      this.swayQuilt.scale.setScalar(this.swayLeft > 0 ? base * (1 + 0.025 * Math.sin(this.time * 7)) : base);
      if (this.swayLeft <= 0) this.swayQuilt = null;
    }
    if (!this.quiltRoot.visible || this.quilts.size === 0 || this.time < this.singUntil || this.flow.phase !== 'play') {
      this.gazeT = 0;
      return;
    }
    this.player.head.getWorldQuaternion(this.gazeQ);
    this.gazeFwd.set(0, 0, -1).applyQuaternion(this.gazeQ);
    let best = '';
    for (const [id, g] of this.quilts) {
      g.getWorldPosition(this.tmp2);
      this.tmp2.sub(this.head);
      const d = this.tmp2.length();
      if (d > 0.3 && this.tmp2.dot(this.gazeFwd) / d > 0.9945) best = id; // within about 6 degrees
    }
    if (!best || best !== this.gazeId) {
      this.gazeId = best;
      this.gazeT = 0;
      return;
    }
    this.gazeT += dt;
    if (this.gazeT < 1.2 || this.time < (this.quiltSongUntil.get(best) ?? 0)) return;
    const ch = CHAPTERS.find((c) => c.id === best);
    const g = this.quilts.get(best);
    if (!ch || !g) return;
    // its pictures, in order, from where the quilt hangs
    g.getWorldPosition(this.tmp2).applyMatrix4(this.inv);
    const pan = panOf(this.tmp2.x);
    audio.resume();
    let t = 0.3;
    for (const id of ch.levels) {
      const lv = LEVELS.find((l) => l.id === id);
      if (!lv || !((this.progress.best[id] ?? 0) > 0)) continue;
      t += this.schedulePictureSong(lv.target, t, pan) + 0.25;
    }
    this.singUntil = this.time + t;
    audio.holdMusic(t + 0.3);
    if (g.userData.baseScale === undefined) g.userData.baseScale = g.scale.x;
    this.swayQuilt = g;
    this.swayLeft = t;
    this.quiltSongUntil.set(best, this.time + t + 15); // not again straight away
    this.gazeT = 0;
    this.debug.quiltSong = best;
  }

  private updateQuilts(dt: number): void {
    if (this.coopLink || this.photoMode) {
      this.quiltRoot.visible = false;
      return;
    }
    if (!this.wall) {
      this.wallSearchIn -= dt;
      if (this.wallSearchIn > 0) return;
      this.wallSearchIn = 1;
      this.wall = this.findWall();
      if (!this.wall) return;
      this.debug.wall = this.wall.at.toArray().map((n) => Math.round(n * 100) / 100);
    }
    this.quiltRoot.visible = true;
    // hang every finished chapter (except one still waiting for its finale)
    const done = CHAPTERS.filter((c) => c.levels.every((id) => (this.progress.best[id] ?? 0) > 0));
    for (let k = 0; k < done.length; k++) {
      const ch = done[k];
      // a chapter just finished waits for its finale and flies over from the shelf (never hung twice)
      if (this.quilts.has(ch.id) || ch.id === this.quiltFlyId || this.quiltFly?.id === ch.id || this.finale?.level.chapter === ch.id) continue;
      const g = this.makeQuilt(ch.id);
      if (!g) continue;
      this.quiltSlot(k, done.length, g.position);
      g.position.y += ((g.userData.height as number) * this.wall.size) / 2; // its middle at eye height
      g.lookAt(this.tmp2.copy(g.position).add(this.wall.n));
      g.scale.setScalar(this.wall.size);
      this.quiltRoot.add(g);
      this.quilts.set(ch.id, g);
    }
    // the finale's flight
    if (this.quiltFlyIn >= 0) {
      this.quiltFlyIn -= dt;
      if (this.quiltFlyIn < 0 && this.quiltFlyId) {
        const id = this.quiltFlyId;
        const g = this.makeQuilt(id);
        if (g) {
          const k = done.findIndex((c) => c.id === id);
          const from = new Vector3(-this.controller.bankSide * PLUSH.shelfX, 0.1, PLUSH.shelfZ);
          this.view.root.localToWorld(from);
          const to = this.quiltSlot(Math.max(0, k), done.length, new Vector3());
          to.y += ((g.userData.height as number) * this.wall.size) / 2;
          const q1 = new Quaternion();
          g.position.copy(to);
          g.lookAt(this.tmp2.copy(to).add(this.wall.n));
          q1.copy(g.quaternion);
          const q0 = new Quaternion().copy(this.view.root.getWorldQuaternion(new Quaternion()));
          g.position.copy(from);
          g.quaternion.copy(q0);
          g.scale.setScalar(0.15);
          this.quiltRoot.add(g);
          this.quiltFly = { id, t: 0, from, to, q0, q1, g };
          audio.hop();
        }
        this.quiltFlyId = '';
      }
    }
    const f = this.quiltFly;
    if (f) {
      f.t = Math.min(1, f.t + dt / 1.6);
      const e = f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2;
      f.g.position.lerpVectors(f.from, f.to, e);
      f.g.position.y += 0.25 * Math.sin(Math.PI * f.t); // a gentle arc up and over
      f.g.quaternion.slerpQuaternions(f.q0, f.q1, e);
      f.g.rotation.z += 0.12 * Math.sin(f.t * Math.PI * 4) * (1 - f.t); // flutters like cloth
      f.g.scale.setScalar(0.15 + (this.wall!.size - 0.15) * e);
      if (f.t >= 1) {
        this.quilts.set(f.id, f.g);
        this.quiltFly = null;
        audio.click(true);
        const name = CHAPTERS.find((c) => c.id === f.id)?.name ?? '';
        this.showNotice(`Your ${name} quilt is on the wall`, 4.5, 'centre');
      }
    }
  }

  /** Where quilt k of n hangs: side by side along the wall, centred straight ahead. */
  private quiltSlot(k: number, n: number, out: Vector3): Vector3 {
    const w = this.wall!;
    // off to the shelf's side of the wall, so the quilts never hang right behind the card
    const right = this.tmp2.set(1, 0, 0).applyQuaternion(this.view.root.getWorldQuaternion(this.tmpQ));
    const shelfSide = -this.controller.bankSide * Math.sign(right.dot(w.t) || 1);
    const off = shelfSide * (QUILT_W * w.size * 0.5 + 0.25 * w.size);
    return out.copy(w.at).addScaledVector(w.t, off + shelfSide * k * (QUILT_W + 0.08) * w.size);
  }

  private makeQuilt(id: string): Group | null {
    const ch = CHAPTERS.find((c) => c.id === id);
    if (!ch) return null;
    const panels = ch.levels.map((l) => LEVELS.find((x) => x.id === l)).filter((l): l is Level => !!l).map((l) => ({ rows: l.target.map((r) => r & 255), color: l.color ?? 0xe2563b }));
    return buildQuilt(ch.name, panels, this.shown().font);
  }

  /** The wall straight ahead of the seat (from the room's vertical planes), or null. */
  private findWall(): { at: Vector3; n: Vector3; t: Vector3; size: number } | null {
    this.forwardFlat(this.fwd);
    let best: { at: Vector3; n: Vector3; t: Vector3; size: number } | null = null;
    let bestT = Infinity;
    const c = new Vector3();
    const n = new Vector3();
    const q = new Quaternion();
    const inv = new Matrix4();
    for (const e of this.queries.planes.entities) {
      const pl = e.getValue(XRPlane, '_plane') as (XRPlane & { semanticLabel?: string }) | undefined;
      const obj = e.object3D;
      if (!pl || !obj || pl.orientation !== 'vertical') continue;
      if (pl.semanticLabel && !/wall|other/i.test(pl.semanticLabel)) continue; // doors and windows are not for hanging things
      obj.updateMatrixWorld();
      obj.getWorldPosition(c);
      n.set(0, 1, 0).applyQuaternion(obj.getWorldQuaternion(q));
      n.y = 0;
      if (n.lengthSq() < 1e-4) continue;
      n.normalize();
      if (n.dot(this.tmp.copy(this.head).sub(c)) < 0) n.negate(); // face the room
      const denom = this.fwd.dot(n);
      if (denom > -0.5) continue; // not facing the seat
      const t = this.tmp.copy(c).sub(this.head).dot(n) / denom;
      if (t < 0.4 || t > 4 || t >= bestT) continue;
      // where the line of sight meets the wall, at the hanging height; it must be on the wall
      const at = new Vector3().copy(this.head).addScaledVector(this.fwd, t);
      at.y = this.head.y; // the quilt's middle at eye height: no looking up past the top of the view
      inv.copy(obj.matrixWorld).invert();
      const local = this.tmp.copy(at).applyMatrix4(inv);
      if (!insidePolygon(pl.polygon, local.x, local.z, 0.15)) continue;
      bestT = t;
      at.addScaledVector(n, 0.012); // just off the wall
      // bigger on a far wall, so it reads from the seat (about 14° across)
      best = { at, n: n.clone(), t: new Vector3(0, 1, 0).cross(n).normalize(), size: Math.min(2.6, Math.max(1.1, (t * 0.33) / QUILT_W)) };
    }
    return best;
  }

  /** A poked card row plays its tune (left to right, like a pass), with notes rising off the card. */
  private playCardRow(r: number): void {
    const lv = this.flow?.level;
    const row = lv?.target[r];
    if (!lv || row === undefined || this.time < this.cardRowUntil) return;
    audio.resume();
    this.cardRowUntil = this.time + 0.45;
    let k = 0;
    for (let w = 0; w < WARPS; w++) if (isLifted(row, w)) audio.pluck(w, 0.35, k++ * 0.07, 0.26);
    const at = this.view.cardRowPos(r, this.tmp2);
    if (at) {
      this.view.fx.note(at.x - 0.02, at.y + 0.01, at.z + 0.01, lv.color ?? 0xe2563b);
      if (k > 3) this.view.fx.note(at.x + 0.02, at.y + 0.015, at.z + 0.01, lv.color ?? 0xe2563b);
    }
    this.debug.cardRow = r;
  }

  /** Remember that the player was here (Pip naps after a long while away). */
  private markSeen(): void {
    this.seenIn = 60;
    this.progress.lastSeen = Date.now();
    saveProgress(this.progress);
  }

  /** The picture-of-the-day ball: offered once the first picture is woven, hidden while today's is on the loom. */
  private syncDaily(): void {
    this.today = dayKey();
    this.dailyDone = (this.progress.days ?? []).includes(this.today);
    const offered = this.progress.tutorialDone && this.picturesDone() >= 3 && !this.coopLink && !this.flow?.daily; // the present: after three pictures
    const lv = dailyLevel(this.today);
    const next = dayKey(new Date(Date.now() + 86400000));
    this.view.daily.set(offered ? (this.dailyDone ? 'done' : 'new') : 'hidden', lv.color ?? 0xe2563b, { key: next, rows: dailyLevel(next).target });
    // the present waits somewhere new each day: one of a few spots in reach, if the real table is there
    const side = this.controller.bankSide;
    const spots = GIFT_SPOTS;
    let h = 0;
    for (let i = 0; i < this.today.length; i++) h = (h * 31 + this.today.charCodeAt(i)) >>> 0;
    let [gx, gz] = spots[0];
    const pick = spots[h % spots.length];
    const at = { x: -side * pick[0], y: 0.01, z: pick[1] };
    if (this.onTable(at)) [gx, gz] = pick;
    this.giftAt[0] = -side * gx;
    this.giftAt[1] = gz;
    this.view.setGiftSpot(this.giftAt[0], this.giftAt[1]);
    this.dailyVec.set(this.giftAt[0], DAILY_BALL.y, this.giftAt[1]);
  }
  private giftDirty = false;
  /** Where today's present stands (loom space x, z). */
  private giftAt: [number, number] = [0, 0];

  /** Weave today's picture (once a day; the ball says when the next one comes). */
  private startDaily(): void {
    if (this.flow.phase !== 'play' || this.coopLink || this.flow.daily || this.grand) return;
    this.syncDaily();
    if (this.dailyDone) {
      audio.tick();
      this.showNotice('A new picture tomorrow', 3, 'centre');
      return;
    }
    const lv = dailyLevel(this.today);
    audio.restyle();
    // the present opens: the lid pops off with a little burst
    this.view.daily.open();
    const side = this.controller.bankSide;
    this.view.fx.confetti(this.giftAt[0], 0.04, this.giftAt[1], 28, 0.45);
    audio.swapYarn();
    this.flow.startChallenge(lv, this.today);
    this.showNotice("Today's picture", 3, 'centre'); // its name is the surprise when it comes alive
  }

  /** Where a just-woven picture's plush goes: its shelf slot, or the desk (already placed there, or a picture of the day). */
  private heroSpot(lv: Level): number {
    if (this.flow.daily) {
      const d = deskIndex(lv.id);
      if (d < 0) return -1;
      if (!this.progress.placed?.[lv.id]) {
        const at = this.freeDeskSpot();
        if (!at) return -1;
        (this.progress.placed ??= {})[lv.id] = at;
        saveProgress(this.progress);
      }
      const [x, z] = this.progress.placed![lv.id];
      this.view.plushes.prepareDesk(PLUSH.slots + d, x, z);
      return PLUSH.slots + d;
    }
    if (this.flow.challenge) return -1;
    if (this.progress.placed?.[lv.id]) {
      const d = deskIndex(lv.id);
      return d < 0 ? shelfSlot(lv) : PLUSH.slots + d;
    }
    return shelfSlot(lv);
  }

  /** A free spot on the desk beside the shelf and basket for a new plush (null: none fits). */
  private freeDeskSpot(): [number, number] | null {
    const s = this.controller.bankSide;
    // nearest the seat first (within the two-foot reach), never nearer than the likely desk edge
    const spots: [number, number][] = [
      [s * 0.2, 0.19], [s * 0.29, 0.18], [s * 0.37, 0.15], [-s * 0.42, 0.12], [s * 0.44, 0.09],
      [s * 0.13, 0.2], [-s * 0.46, 0.05], [s * 0.5, 0.03], [-s * 0.5, -0.03], [s * 0.42, -0.08],
    ];
    const taken = Object.values(this.progress.placed ?? {});
    for (const [x, z] of spots) {
      if (taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.055)) continue;
      if (this.onProp(x, z, 0.03)) continue; // never on the telephone or the present
      if (!this.onTable({ x, y: 0.01, z })) continue;
      return [x, z];
    }
    return null;
  }

  /** The spot index of the plush sitting on the friend's cushion (-1: nobody). */
  private seated = -1;
  /** The picture on the loom hasn't been woven before: its name waits for the win. */
  private nameHidden = false;

  /**
   * Seat plush i on the cushion: it hops there (not saved: it goes home when the picture
   * changes) and lifts the threads of its picture's bottom row, in its own colour.
   */
  private seatFriend(i: number, id: string): void {
    const pic = pictureById(id);
    const d = deskIndex(id);
    if (!pic || d < 0) {
      this.view.plushes.putBack(i);
      return;
    }
    const side = this.controller.bankSide;
    const to = PLUSH.slots + d;
    this.view.plushes.moveTo(i, to, side * FRIEND_SEAT.x, FRIEND_SEAT.z, FRIEND_SEAT.top);
    this.seated = to;
    const feet = pic.target[0] & 255;
    this.model.setHelper(feet);
    this.view.setFriend(feet, pic.color ?? 0xe2563b);
    for (let w = 0, k = 0; w < WARPS; w++) if ((feet >> w) & 1) audio.pluck(w, 0.4, 0.05 + k++ * 0.06, 0.24);
    this.view.setPipMood('happy');
    this.debug.lastDrop = `friend ${id}`;
    if (this.debug) this.debug.friend = id;
  }

  /** The feet shown as faint strings while a plush is carried over the cushion (0: none). */
  private previewKey = 0;
  private previewFriend(): void {
    let key = 0;
    let color = 0;
    if (this.flow.level?.friend && this.seated < 0 && this.flow.phase === 'play') {
      const ci = this.view.plushes.carried;
      const side = this.controller.bankSide;
      if (ci >= 0 && this.view.plushes.plushCentre(ci, this.tmp2) && Math.hypot(this.tmp2.x - side * FRIEND_SEAT.x, this.tmp2.z - FRIEND_SEAT.z) < FRIEND_SEAT.r + 0.05) {
        const pic = pictureById(this.view.plushes.idAt(ci) ?? '');
        if (pic) {
          key = pic.target[0] & 255;
          color = pic.color ?? 0xe2563b;
        }
      }
    }
    if (key === this.previewKey) return;
    this.previewKey = key;
    if (this.seated < 0) this.view.previewFriend(key, color);
  }

  /**
   * Pip notices you: look straight at it for a moment while it sits on its perch and it
   * turns, hops and waves (a sleeping Pip wakes instead). Not more than once every 25 s.
   */
  private pipGazeT = 0;
  private pipWaveAt = -99;
  private pipGazePos = new Vector3();
  private gazePip(dt: number): void {
    const held = this.controller.shuttle.held || this.controller.autoThrow;
    if (held || this.time - this.pipWaveAt < 25 || this.grand) {
      this.pipGazeT = 0;
      return;
    }
    this.view.shuttle.getWorldPosition(this.pipGazePos).sub(this.head);
    const d = this.pipGazePos.length();
    this.player.head.getWorldQuaternion(this.gazeQ);
    this.gazeFwd.set(0, 0, -1).applyQuaternion(this.gazeQ);
    const looking = d > 0.1 && this.pipGazePos.dot(this.gazeFwd) / d > 0.9962; // within about 5 degrees
    this.pipGazeT = looking ? this.pipGazeT + dt : 0;
    if (this.pipGazeT < 0.9) return;
    this.pipGazeT = 0;
    this.pipWaveAt = this.time;
    if (this.view.pipAsleep) {
      this.view.wakePip();
      return;
    }
    if (!this.view.pipIdle) return;
    this.view.setPipMood('wave');
    audio.pipGrab(); // a small hello
    this.debug.pipNoticed = (this.debug.pipNoticed ?? 0) + 1;
  }

  /** A wrong row waiting to unweave itself (-1: none), and when. */
  private autoUndoRow = -1;
  private autoUndoAt = 0;
  private autoUndo(): void {
    const r = this.autoUndoRow;
    if (r < 0 || this.time < this.autoUndoAt) return;
    this.autoUndoRow = -1;
    const c = this.controller;
    const rows = this.model.rows;
    // only that same wrong row, still the last one, with nothing in hand and no partner steering
    if (this.flow.phase !== 'play' || rows.length !== r + 1 || rows[r] === this.flow.level.target[r]) return;
    if (c.shuttle.held || c.autoThrow || c.holding.left || c.holding.right || this.coopLink instanceof CoopGuest) return;
    c.doUndo();
    c.undoQuietUntil = performance.now() + 900;
    this.debug.autoUndo = (this.debug.autoUndo ?? 0) + 1;
  }

  /**
   * Stroke Pip: a flat palm passing over it (not a poke, not a pinch), about 8 cm of stroke within
   * 1.5 s, and it closes its eyes, trills, and a few felt hearts float up. Every few seconds at most.
   */
  private strokeLen = 0;
  private strokeT = 0;
  private strokeAt = -99;
  private strokePrev = { left: new Vector3(), right: new Vector3() };
  private strokeHad = { left: false, right: false };
  private strokePos = new Vector3();
  private strokePip(dt: number): void {
    const c = this.controller;
    if (c.shuttle.held || c.autoThrow || this.time - this.strokeAt < 4) {
      this.strokeLen = 0;
      return;
    }
    this.view.shuttle.getWorldPosition(this.strokePos);
    let moved = 0;
    for (const side of ['left', 'right'] as const) {
      const h = hands[side];
      const prev = this.strokePrev[side];
      if (!h.tracked || h.pinch.pinching) {
        this.strokeHad[side] = false;
        continue;
      }
      // the palm just over Pip, the fingertip not on it (that would be a poke)
      const near = h.palm.distanceTo(this.strokePos) < 0.065 && h.indexTip.distanceTo(this.strokePos) > 0.025 && h.palm.y > this.strokePos.y;
      if (near && this.strokeHad[side]) moved += Math.hypot(h.palm.x - prev.x, h.palm.z - prev.z);
      prev.copy(h.palm);
      this.strokeHad[side] = near;
    }
    this.strokeT = moved > 0 ? this.strokeT + dt : Math.max(0, this.strokeT - dt);
    this.strokeLen = this.strokeT > 1.5 ? 0 : this.strokeLen + moved;
    if (this.strokeLen < 0.08) return;
    this.strokeLen = 0;
    this.strokeT = 0;
    this.strokeAt = this.time;
    if (this.view.pipAsleep) this.view.wakePip();
    this.view.petPip();
    audio.pipGrab();
    audio.pipGrab();
    this.strokePos.applyMatrix4(this.inv);
    this.view.fx.confetti(this.strokePos.x, this.strokePos.y + 0.03, this.strokePos.z, 6, 0.25);
    this.debug.pipPetted = (this.debug.pipPetted ?? 0) + 1;
  }

  /**
   * Look to play (accessibility): no hands needed. Look at a lever, Pip, the undo spool, the yarn swap
   * or (with the cushion out) a plush for a moment and it is pressed; a felt dot grows on it as you look.
   */
  private lookKey = '';
  private lookT = 0;
  /** Pressed and still being looked at: look away before it can be pressed again. */
  private lookSpent = false;
  private lookTold = false;
  private lookO = new Vector3();
  private lookD = new Vector3();
  private lookC = new Vector3();
  private lookP = { x: 0, y: 0, z: 0 };
  private lookToPlay(dt: number): void {
    const c = this.controller;
    if (this.flow.phase !== 'play' || !c.enabled || c.shuttle.held || c.autoThrow) {
      this.lookT = 0;
      this.view.setGazeDot(0, 0, 0, 0);
      return;
    }
    // the head's ray, in the loom's space
    this.player.head.getWorldQuaternion(this.gazeQ);
    this.lookO.copy(this.head).applyMatrix4(this.inv);
    this.lookD.set(0, 0, -1).applyQuaternion(this.gazeQ).add(this.head).applyMatrix4(this.inv).sub(this.lookO).normalize();
    let best = '';
    let bestCos = 0.9972; // within about 4 degrees
    let bx = 0;
    let by = 0;
    let bz = 0;
    const consider = (key: string, x: number, y: number, z: number) => {
      this.lookC.set(x, y, z).sub(this.lookO);
      const d = this.lookC.length();
      const cos = d > 0.05 ? this.lookC.dot(this.lookD) / d : 0;
      if (cos > bestCos) {
        bestCos = cos;
        best = key;
        bx = x;
        by = y;
        bz = z;
      }
    };
    for (let k = 0; k < c.activeLevers; k++) {
      c.leverPos(k, this.lookP);
      consider(`lever${k}`, this.lookP.x, this.lookP.y, this.lookP.z);
    }
    const sx = c.shuttleX();
    consider('pip', sx, shuttleY(sx), SHUTTLE.z);
    if (this.model.rows.length) {
      c.bobbinPos(this.lookP);
      consider('undo', this.lookP.x, this.lookP.y, this.lookP.z);
    }
    if (c.swapSpot) consider('swap', c.swapSpot.x, c.swapSpot.y, c.swapSpot.z);
    if (this.flow.level.friend) {
      for (let i = 0; i < SPOTS; i++) {
        const p = c.plushSpots[i];
        if (p) consider(`plush${i}`, p.x, p.y, p.z);
      }
    }
    if (best !== this.lookKey) {
      this.lookKey = best;
      this.lookT = 0;
      this.lookSpent = false;
    }
    if (!best || this.lookSpent) {
      this.view.setGazeDot(0, 0, 0, 0);
      return;
    }
    if (!this.lookTold) {
      this.lookTold = true;
      this.showNotice('Look to play: look at a lever or Pip for a moment to press it', 6, 'centre');
    }
    this.lookT += dt;
    const DWELL = 1.1;
    this.view.setGazeDot(bx, by, bz, Math.max(0, Math.min(1, this.lookT / DWELL)));
    if (this.lookT < DWELL) return;
    this.lookSpent = true; // once per look: glance away to press it again
    audio.tick();
    if (best.startsWith('lever')) c.toggleLever(Number(best.slice(5)));
    else if (best === 'pip') c.throwShuttle();
    else if (best === 'undo') c.doUndo();
    else if (best === 'swap') c.hooks.swap?.();
    else if (best.startsWith('plush')) c.hooks.plush?.(Number(best.slice(5)));
    this.debug.lookPressed = best;
  }

  /** The spot a plush is in now (-1: none). */
  private spotOf(id: string): number {
    for (let i = 0; i < SPOTS; i++) if (this.view.plushes.idAt(i) === id) return i;
    return -1;
  }

  /** The seated friend hops back where it lives: its shelf slot, or its saved place on the desk. */
  private sendFriendHome(): void {
    const i = this.seated;
    const id = i >= 0 ? this.view.plushes.idAt(i) : null;
    this.unseatFriend();
    if (!id) return;
    const at = this.progress.placed?.[id];
    const slot = this.shelf.findIndex((it) => it.id === id);
    if (at) this.view.plushes.moveTo(i, i, at[0], at[1]);
    else if (slot >= 0) this.view.plushes.moveTo(i, slot);
    audio.pluck(2, 0.35, 0, 0.08);
  }

  private unseatFriend(): void {
    this.seated = -1;
    this.model.setHelper(0);
    this.view.setFriend(0, 0xffffff);
    if (this.debug) this.debug.friend = '';
  }

  /** Is a plush at (x, z) on the toy telephone or the present (with `margin` more room)? */
  private onProp(x: number, z: number, margin: number): boolean {
    const side = this.controller.bankSide;
    const phone = this.view.phone.root.visible && Math.hypot(x - side * TOY_PHONE.x, z - TOY_PHONE.z) < 0.06 + margin;
    const gift = this.view.daily.root.visible && Math.hypot(x - this.giftAt[0], z - this.giftAt[1]) < 0.045 + margin;
    return phone || gift;
  }

  /**
   * A carried plush was let go. On the real table (a detected plane at the desk's
   * height, or near the loom when the room has no planes) it stays there, saved;
   * near its own shelf slot it goes back; anywhere else (off the edge, in the air,
   * inside the loom) it hops back where it came from.
   */
  private dropPlush(i: number, p: { x: number; y: number; z: number } | null): void {
    const plushes = this.view.plushes;
    const id = plushes.idAt(i);
    if (!id) return;
    if (!p) {
      plushes.putBack(i);
      return;
    }
    const side = this.controller.bankSide;
    // a friend picture's cushion: a plush set down on it sits there and lifts the threads under its feet
    if (this.flow.level.friend && this.flow.phase === 'play' && p.y < 0.15 && Math.hypot(p.x - side * FRIEND_SEAT.x, p.z - FRIEND_SEAT.z) < FRIEND_SEAT.r + 0.03) {
      this.seatFriend(i, id);
      return;
    }
    const slot = this.shelf.findIndex((it) => it.id === id);
    const home = slot >= 0 ? plushes.slotPos(slot, this.tmp2) : null;
    if (home && Math.hypot(p.x - home.x, p.z - home.z) < 0.07 && p.y < 0.12) {
      // back onto the shelf
      plushes.moveTo(i, slot);
      if (this.progress.placed) delete this.progress.placed[id];
      saveProgress(this.progress);
      this.shelf[slot].placed = false;
      this.debug.lastDrop = 'shelf';
      return;
    }
    const nearShelf = Math.abs(p.x + side * PLUSH.shelfX) < 0.15 && Math.abs(p.z - PLUSH.shelfZ) < 0.06;
    const inLoom = Math.abs(p.x) < LOOM.frameHalfWidth + 0.03 && p.z > LOOM.backBeamZ - 0.03 && p.z < LOOM.frontBeamZ + 0.02;
    const inBank = Math.abs(p.x - side * 0.23) < 0.11 && Math.abs(p.z) < 0.1; // the lever bank
    const inBasket = Math.hypot(p.x + side * BASKET.x, p.z - BASKET.z) < 0.085; // the chapter basket
    const onPlaque = Math.abs(p.x) < 0.11 && p.z > 0.09 && p.z < 0.2; // the level plaque
    const tooHigh = p.y > 0.2;
    const d = deskIndex(id);
    if (d < 0 || nearShelf || inLoom || inBank || inBasket || onPlaque || this.onProp(p.x, p.z, 0) || tooHigh || !this.onTable(p)) {
      plushes.putBack(i);
      audio.pluck(2, 0.35, 0, 0.05);
      this.debug.lastDrop = 'back';
      return;
    }
    const x = Math.round(p.x * 1000) / 1000;
    const z = Math.round(p.z * 1000) / 1000;
    plushes.moveTo(i, PLUSH.slots + d, x, z);
    (this.progress.placed ??= {})[id] = [x, z];
    saveProgress(this.progress);
    if (slot >= 0) this.shelf[slot].placed = true;
    this.view.fx.confetti(x, 0.01, z, 18, 0.25);
    this.view.setPipMood('happy');
    this.debug.lastDrop = `desk ${x},${z}`;
    // set down beside a friend: they say hello (both bounce, each chimes its first note)
    let k = 0;
    for (const [other, at] of Object.entries(this.progress.placed)) {
      if (other === id || Math.hypot(at[0] - x, at[1] - z) > 0.12) continue;
      const j = this.spotOf(other);
      const opic = pictureById(other);
      if (j < 0 || !opic) continue;
      this.view.plushes.sing(j, 0.9, 0.15 + k * 0.2);
      const note = (rows: readonly number[]) => {
        const r0 = rows[rows.length - 1] & 255; // the top row
        for (let w = 0; w < WARPS; w++) if ((r0 >> w) & 1) return w;
        return 3;
      };
      audio.pluck(note(opic.target), 0.4, 0.15 + k * 0.2, 0.2, panOf(at[0]));
      k++;
      this.debug.hello = (this.debug.hello ?? 0) + 1;
    }
    if (k) {
      const me = pictureById(id);
      this.view.plushes.sing(PLUSH.slots + d, 0.9, 0);
      if (me) audio.pluck(3, 0.4, 0, 0.2, panOf(x));
    }
    if (Object.keys(this.progress.placed).length === 1) this.showNotice('It lives on your desk now', 4, 'centre');
  }

  /**
   * Is this loom-space point over the real table? When the loom was set on a
   * detected table plane, that plane (or another at the desk's height) must lie
   * under the point: off the table's edge it won't stay. When the table isn't in
   * the room data (placed by palm alone), anywhere within reach of the loom.
   */
  private onTable(p: { x: number; y: number; z: number }): boolean {
    if (this.placement.source !== 'plane') return Math.hypot(p.x, p.z) < 0.55;
    const root = this.view.root;
    this.tmp2.set(p.x, 0, p.z);
    root.localToWorld(this.tmp2);
    const deskY = this.tmp2.y;
    this.planesUnder(this.tmp2);
    return this.planeYs.some((y) => Math.abs(y - deskY) < 0.05);
  }

  /** Where the shelf plushes are, for touch (no allocation: one vector per slot). */
  private syncPlushSpots(): void {
    const c = this.controller;
    for (let i = 0; i < this.plushVecs.length; i++) {
      const at = this.view.plushes.plushCentre(i, this.plushVecs[i]);
      c.plushSpots[i] = this.coopLink ? null : at;
    }
    this.view.plushes.hover(Math.max(indexOfKind(c.hover.left, 'plush'), indexOfKind(c.hover.right, 'plush')));
    c.keySpot = this.coopLink || this.flow?.challenge || !this.view.plushes.shelfShown ? null : this.view.plushes.keyCentre(this.keyVec);
    c.swapSpot = this.flow?.level?.weft && !this.coopLink ? this.view.swapSpoolPos(this.swapVec) : null; // follows the lever side
    this.view.setSwapHighlight(isKind(c.hover.left, 'swap') || isKind(c.hover.right, 'swap') ? 1 : 0, this.swapGlow);
    this.view.plushes.hoverKey(isKind(c.hover.left, 'windKey') || isKind(c.hover.right, 'windKey'));
    c.dailySpot = this.view.daily.root.visible && this.flow?.phase === 'play' && !this.grand ? this.dailyVec : null;
    // the card's rows can be poked to hear them (not while a caller holds the picture: that would give it away)
    const rowsOk = this.flow?.phase === 'play' && !this.view.card.secret && !this.coopLink;
    for (let r = 0; r < 8; r++) c.cardRows[r] = rowsOk ? this.view.cardRowPos(r, this.cardRowVecs[r]) : null;
    this.view.daily.hover(isKind(c.hover.left, 'daily') || isKind(c.hover.right, 'daily'));
    // the toy telephone: once the first picture is done (never in the first minutes), not during the finale
    const ph = this.view.phone;
    // the telephone: once Garden is woven, or straight away when a call is hosted (e.g. from the 2D page)
    const calling = coop.status.state === 'hosting' || (coop.status.state === 'connected' && coop.status.role === 'host');
    ph.root.visible = ((this.progress.tutorialDone && this.picturesDone() >= 4) || calling) && !this.grand;
    this.phoneVec.set(this.controller.bankSide * TOY_PHONE.x, TOY_PHONE.y, TOY_PHONE.z);
    c.phoneSpot = ph.root.visible && this.flow?.phase === 'play' && !this.flow.challenge ? this.phoneVec : null;
    ph.hover(isKind(c.hover.left, 'phone') || isKind(c.hover.right, 'phone'));
  }

  /** The toy telephone: call a friend (host a loom and show its code), or hang up. */
  private pokePhone(): void {
    audio.resume();
    const st = coop.status.state;
    if (st === 'hosting' || st === 'connected' || st === 'joining') {
      coop.leave();
      this.view.phone.setState('idle');
      audio.click(false);
      return;
    }
    audio.chirp('happy');
    this.view.phone.setState('calling', '…');
    // where the friend goes: this page's address, short (no https://, no trailing slash)
    const where = (location.host + location.pathname).replace(/\/(index\.html)?$/, '');
    this.showNotice(`Your friend opens ${where} on a phone and types the code`, 9, 'centre');
    void coop.host();
  }

  /** Hover tooltips for the secondary controls (levers and Pip have their own hints). */
  private syncTip(dt: number): void {
    const c = this.controller;
    const t = (c.hover.right ?? c.hover.left) as { kind?: string; i?: number } | null;
    const code = targetCode(t);
    if (code !== this.tipCode) {
      this.tipCode = code;
      this.tipHover = 0;
      this.tipReady = false;
      this.tipShown = false;
    }
    if (!t || this.notice) {
      this.tip.mesh.visible = false;
      return;
    }
    this.tipHover += dt;
    if (this.tipHover < 0.3) return;
    if (this.tipReady) {
      this.tip.mesh.visible = this.tipShown;
      return;
    }
    this.tipReady = true; // work out the words once per hover (no per-frame strings)
    const side = c.bankSide;
    const step = this.flow?.hintStep;
    let text = '';
    const at = this.tagAt;
    let lift = 0.04;
    switch (t.kind) {
      case 'token':
        text = 'Change the style';
        at.x = tokenX(side);
        at.y = TOKEN.y;
        at.z = TOKEN.z;
        break;
      case 'cardRow': {
        const p = c.cardRows[t.i ?? 0];
        if (p) Object.assign(at, p);
        text = 'Poke a row to hear it';
        lift = 0.03;
        break;
      }
      case 'daily': {
        if (c.dailySpot) Object.assign(at, c.dailySpot);
        const n = streakOf(this.progress.days ?? [], this.today);
        text = this.dailyDone ? (n >= 2 ? `${n} days in a row` : 'A new one tomorrow') : `Today: ${dailyLevel(this.today).name}`;
        lift = 0.045;
        break;
      }
      case 'windKey':
        if (c.keySpot) Object.assign(at, c.keySpot);
        at.x -= side * 0.05; // out past the key, never over a plush
        text = 'Play the shelf';
        break;
      case 'swap':
        if (step !== 'weft' && c.swapSpot) {
          Object.assign(at, c.swapSpot);
          text = "Swap Pip's yarn";
          lift = 0.05;
        }
        break;
      case 'bobbin':
        if (step !== 'undo') {
          at.x = bobbinX(side);
          at.y = BOBBIN.y;
          at.z = BOBBIN.z;
          text = 'Pull to undo';
          lift = 0.06;
        }
        break;
      case 'skein': {
        const i = t.i ?? 0;
        skeinPos(i, side, at);
        const st = chapterStates(this.progress, this.flow?.level?.chapter)[i];
        text = st === 'locked' ? `${CHAPTERS[i]?.name ?? ''} (locked)` : (CHAPTERS[i]?.name ?? '');
        break;
      }
      case 'plush': {
        const i = t.i ?? 0;
        const id = this.view.plushes.idAt(i);
        const spot = c.plushSpots[i];
        if (id && spot && this.view.plushes.carried < 0) {
          Object.assign(at, spot);
          const name = pictureById(id)?.name ?? '';
          text = i < PLUSH.slots ? `${name}: poke to sing, pinch to carry` : `${name}: poke to sing`;
          lift = 0.045;
        }
        break;
      }
    }
    this.tipShown = !!text;
    this.tip.mesh.visible = this.tipShown;
    if (!text) return;
    this.tip.set(text);
    this.tip.mesh.position.set(at.x, at.y + lift, at.z);
  }

  /** Chapter pictures woven so far (props arrive as this grows). */
  private picturesDone(): number {
    let n = 0;
    for (const l of LEVELS) if ((this.progress.best[l.id] ?? 0) > 0) n++;
    return n;
  }

  /** Basket balls: one per chapter, coloured when unlocked, lifted for the current one. */
  private syncBasket(level: Level): void {
    const states = chapterStates(this.progress, level.chapter);
    this.view.basket.set(
      CHAPTERS.map((c) => c.name),
      CHAPTERS.map((c) => CHAPTER_COLORS[c.id] ?? 0xe2563b),
      states,
    );
    this.controller.skeins = this.coopLink ? 0 : CHAPTERS.length;
  }

  /** A chapter's yarn ball was pressed: jump to its first unfinished picture. */
  private pickChapter(i: number): void {
    const ch = CHAPTERS[i];
    if (!ch || this.flow.phase !== 'play' || this.coopLink || this.grand) return;
    const states = chapterStates(this.progress, this.flow.level.chapter);
    if (states[i] === 'locked') {
      audio.tick();
      this.showNotice(`Finish ${CHAPTERS[i - 1]?.name ?? 'the last'} first`, 3, 'centre');
      return;
    }
    if (states[i] === 'current') return;
    const id = ch.levels.find((l) => !((this.progress.best[l] ?? 0) > 0)) ?? ch.levels[0];
    const idx = LEVELS.findIndex((l) => l.id === id);
    if (idx < 0) return;
    audio.restyle();
    this.flow.start(idx);
    this.showNotice(ch.name, 2.5, 'centre');
  }

  private showNotice(text: string, seconds: number, at: 'token' | 'nudge' | 'centre' | 'unlock' | 'shelf' = 'token'): void {
    this.notice = text;
    this.noticeAt = at;
    this.noticeTimer = seconds;
    this.debug.notice = text;
    if (text) (this.debug.notices ??= []).push(text) > 8 && this.debug.notices.shift(); // recent notices (tests)
    // Clearing a notice brings back the tutorial hint it covered.
    this.tutor.set(text || this.hintText(this.flow.hintStep));
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.debug.paused = p;
    audio.setPaused(p);
  }

  update(delta: number) {
    try {
      this.step(delta);
    } catch (e) {
      reportFrameError('GameSystem', e);
    }
  }

  private step(delta: number) {
    const dt = Math.min(delta, 0.05);
    if (this.paused) return;
    this.watchFrames(delta);
    const immersive = this.visibilityState.peek() !== VisibilityState.NonImmersive;
    // the background music box plays only in the game (never on the 2D page)
    if (immersive && this.placement.phase === 'placed') audio.music();
    else audio.restMusic();
    this.player.head.getWorldPosition(this.head);
    if (immersive) this.watchControllers(dt);

    if (this.placement.phase !== 'placed') {
      if (!immersive) return;
      this.sessionTime += dt;
      this.updatePlacement(dt);
      return;
    }

    // Bloom-in animation.
    if (this.bloom < 1) {
      this.bloom = Math.min(1, this.bloom + dt / 0.6);
      // easeOutBack: the loom unfolds with a little bounce
      const b = this.bloom - 1;
      const e = 1 + 2.2 * b * b * b + 1.2 * b * b;
      this.view.root.scale.setScalar(0.05 + 0.95 * e);
      this.view.setReveal(this.bloom * 1.15);
      this.view.root.updateMatrixWorld();
    }

    this.inv.copy(this.view.root.matrixWorld).invert();
    if (this.calibrator) {
      this.updateCalibration(dt);
      this.syncView(dt);
      return;
    }
    for (const side of ['left', 'right'] as const) this.fillInput(side);
    this.controller.radiusMul = calibration.radiusMul;
    this.controller.update(this.handInputs, dt);
    this.flow.update(dt);
    this.coopLink?.tick(dt);
    // a caller's pins mark one row's threads: they come out once that row is woven, or the picture changes
    const pinKey = this.flow.index * 1000 + this.model.rows.length;
    if (pinKey !== this.pinKey) {
      this.pinKey = pinKey;
      this.view.clearPins();
    }
    this.time += dt;
    this.syncView(dt);
    this.debug.flow = this.flow.phase;
    this.debug.challenge = this.flow.challenge;
    this.debug.anchored = this.loomEntity.hasComponent(XRAnchor) && this.loomEntity.getValue(XRAnchor, 'attached') === true;
    if (this.debug.anchored) this.saveLoomPose();
    if (this.giftDirty) {
      this.giftDirty = false;
      this.syncDaily();
    }
    this.updateQuilts(dt);
    this.gazeQuilts(dt);
    this.gazePip(dt);
    this.strokePip(dt);
    if (this.settings.lookToPlay) this.lookToPlay(dt);
    else if (this.view.gazeDot.visible) this.view.gazeDot.visible = false;
    // Pip wakes when a hand comes near the loom's controls (or after a while on its own)
    if (this.view.pipAsleep) {
      this.asleepFor += dt;
      // the hand that placed the loom is right beside it: wake on a reach in, once the hands have moved off
      const dist = (h: HandInput) => (h.tracked ? Math.hypot(h.index.x, h.index.y - 0.05, h.index.z) : 9);
      const d = Math.min(dist(this.handInputs.left), dist(this.handInputs.right));
      if (d > 0.36) this.napArmed = true;
      if ((this.napArmed && d < 0.28) || this.asleepFor > 25) {
        this.view.wakePip();
        audio.chirp('happy');
      }
    }
    this.seenIn -= dt;
    if (this.seenIn <= 0) this.markSeen();
    this.debug.levelIndex = this.flow.index;
  }

  /** World-space positions of every interactable (E2E + check:reach). */
  targets(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    if (this.placement.phase !== 'placed') return out;
    const v = new Vector3();
    const p = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < LEVERS; k++) {
      this.controller.leverPos(k, p);
      v.set(p.x, p.y, p.z).applyMatrix4(this.view.root.matrixWorld);
      out[`lever${k}`] = v.toArray();
    }
    for (const [name, x] of [
      ['shuttle', this.controller.shuttleX()],
      ['shuttleMin', SHUTTLE.minX],
      ['shuttleMax', SHUTTLE.maxX],
    ] as const) {
      v.set(x, shuttleY(x), SHUTTLE.z).applyMatrix4(this.view.root.matrixWorld);
      out[name] = v.toArray();
    }
    v.set(0, 0, LEVER.restZ - LEVER.travel).applyMatrix4(this.view.root.matrixWorld);
    out.leverLatchedZRef = v.toArray();
    this.controller.bobbinPos(p);
    v.set(p.x, p.y, p.z).applyMatrix4(this.view.root.matrixWorld);
    out.bobbin = v.toArray();
    v.set(p.x, p.y, p.z + BOBBIN.pull).applyMatrix4(this.view.root.matrixWorld);
    out.bobbinPulled = v.toArray();
    v.set(tokenX(this.controller.bankSide), TOKEN.y, TOKEN.z).applyMatrix4(this.view.root.matrixWorld);
    out.token = v.toArray();
    v.set(nudgeX(this.controller.bankSide), NUDGE.y, NUDGE.upZ).applyMatrix4(this.view.root.matrixWorld);
    out.nudgeUp = v.toArray();
    v.set(nudgeX(this.controller.bankSide), NUDGE.y, NUDGE.downZ).applyMatrix4(this.view.root.matrixWorld);
    out.nudgeDown = v.toArray();
    out.head = this.head.toArray();
    return out;
  }

  /**
   * Loomsong is played with bare hands. Holding controllers, nothing responds, so say
   * so: the table prompt asks for them to be put down, and once the loom is out a
   * notice says it (again every 12 s while they're still held). On Quest, setting the
   * controllers down switches to hand tracking by itself.
   */
  private watchControllers(dt: number): void {
    const sess = this.renderer.xr.getSession?.();
    let held = false;
    const srcs = sess?.inputSources;
    if (srcs) {
      for (let i = 0; i < srcs.length; i++) {
        const src = srcs[i];
        if (!src.hand && (src.handedness === 'left' || src.handedness === 'right')) held = true;
      }
    }
    this.debug.controllers = held;
    if (this.placement.phase !== 'placed') {
      this.hint.set(held ? 'Put the controllers down' : 'Rest your hand here');
      return;
    }
    if (!held) {
      this.padsNoticeIn = 0;
      return;
    }
    this.padsNoticeIn -= dt;
    if (this.padsNoticeIn <= 0) {
      this.padsNoticeIn = 12;
      this.showNotice('Put the controllers down: play with your hands', 6, 'centre');
    }
  }
  private padsNoticeIn = 0;

  private updatePlacement(dt: number) {
    if (FIXED_DESK !== null && Number.isFinite(Number(FIXED_DESK))) {
      this.placement.place(Number(FIXED_DESK), 'fixed');
      this.placeLoom(this.firstHand ?? 'right');
      return;
    }
    // Hint sits where the loom will appear, facing the user.
    this.forwardFlat(this.fwd);
    this.hint.mesh.visible = true;
    this.hint.mesh.position
      .copy(this.head)
      .addScaledVector(this.fwd, PLACE.forward + 0.05);
    this.hint.mesh.position.y = this.head.y - 0.28;
    this.hint.mesh.lookAt(this.head);

    // The room remembers: the same persistent anchor came back, so the loom stands where it was left.
    if (this.sessionTime < RESUME_WINDOW_S && this.tryResume()) return;

    let placed = false;
    for (const side of ['right', 'left'] as const) {
      const h = hands[side];
      if (!h.tracked) continue;
      const sample = {
        x: h.palm.x,
        y: h.palm.y,
        z: h.palm.z,
        radius: h.palmRadius,
        upDot: h.upDot,
      };
      this.planesUnder(h.palm);
      if (this.placement.update(sample, this.planeYs, dt, this.head.y)) {
        this.firstHand = side;
        placed = true;
        break;
      }
      if (this.placement.phase === 'steadying') {
        this.holdRing.position.set(h.palm.x, h.palm.y - h.palmRadius + 0.004, h.palm.z);
        break; // only one hand at a time
      }
    }
    this.holdRing.count =
      this.placement.phase === 'steadying' && !placed ? Math.ceil(this.placement.progress * HOLD_DOTS) : 0;
    const noHands = !hands.left.tracked && !hands.right.tracked;
    if (!placed && noHands) this.placement.update(null, [], dt);
    // Fallbacks (spec §5.1): no hand at all, or no flat palm for a while.
    if (
      !placed &&
      ((noHands && this.sessionTime > PLACE.noHandTimeoutS) ||
        this.sessionTime > PLACE.palmTimeoutS)
    ) {
      this.placement.placeDefault(this.head.y);
      placed = true;
    }
    this.debug.phase = this.placement.phase;
    if (placed) this.placeLoom(this.firstHand ?? 'right');
  }

  /**
   * Heights of horizontal detected planes whose polygon lies under `p`
   * (5 cm margin). Floors/ceilings are ignored. Result in this.planeYs.
   */
  private planesUnder(p: Vector3) {
    this.planeYs.length = 0;
    for (const e of this.queries.planes.entities) {
      const pl = e.getValue(XRPlane, '_plane') as
        | (XRPlane & { semanticLabel?: string })
        | undefined;
      const obj = e.object3D;
      if (!pl || !obj || pl.orientation !== 'horizontal') continue;
      if (pl.semanticLabel === 'floor' || pl.semanticLabel === 'ceiling') continue;
      obj.updateMatrixWorld();
      this.planeInv.copy(obj.matrixWorld).invert();
      this.tmp.copy(p).applyMatrix4(this.planeInv);
      if (!insidePolygon(pl.polygon, this.tmp.x, this.tmp.z, 0.05)) continue;
      obj.getWorldPosition(this.tmp);
      this.planeYs.push(this.tmp.y);
    }
  }

  /** IWSDK's room anchor (restored from its persistent handle when the room is the same). */
  private roomAnchor(): { group: Object3D; uuid: string } | null {
    if (!this.world.session?.enabledFeatures?.includes('anchors')) return null;
    const su = this.world.getSystem(SceneUnderstandingSystem) as unknown as { xrAnchor?: unknown; anchoredGroup?: Object3D } | undefined;
    if (!su?.xrAnchor || !su.anchoredGroup) return null;
    let uuid: string | null = null;
    try {
      uuid = localStorage.getItem(ANCHOR_KEY);
    } catch {
      return null;
    }
    return uuid ? { group: su.anchoredGroup, uuid } : null;
  }

  /**
   * Last session's loom, if the same persistent anchor is back and the spot is
   * still a desk within seated reach (a different room or seat: place it afresh).
   */
  private tryResume(): boolean {
    const saved = this.progress.loom;
    if (!saved || this.coopLink || this.settings.placeFresh) return false;
    const a = this.roomAnchor();
    if (!a || a.uuid !== saved.uuid) return false;
    a.group.updateMatrixWorld(true);
    const at = this.tmp2.set(saved.x, saved.y, saved.z).applyMatrix4(a.group.matrixWorld);
    const ahead = Math.hypot(at.x - this.head.x, at.z - this.head.z);
    const drop = this.head.y - at.y;
    if (ahead > 0.85 || drop < PLACE.minDrop || drop > PLACE.maxDropWithPlane) return false;
    this.placement.place(at.y, saved.source);
    this.placement.palmX = at.x;
    this.placement.palmZ = at.z;
    this.resumed = true;
    this.placeLoom(saved.side === -1 ? 'left' : 'right', saved);
    // under the anchor, at the saved local pose (IWSDK's attach keeps it there)
    const root = this.view.root;
    a.group.add(root);
    root.position.set(saved.x, saved.y, saved.z);
    root.rotation.set(0, saved.yaw, 0);
    root.updateMatrixWorld(true);
    this.debug.deskSource = 'resumed';
    this.debug.loomOrigin = root.getWorldPosition(this.tmp2).toArray().map((n) => Math.round(n * 1e4) / 1e4);
    this.showNotice('Right where you left it', 4, 'centre');
    return true;
  }

  /** Once the loom is held by the room anchor, remember where (so the next session can resume). */
  private saveLoomPose(): void {
    if (this.loomSaved || this.coopLink) return;
    const a = this.roomAnchor();
    const root = this.view.root;
    if (!a || root.parent !== a.group) return;
    this.loomSaved = true;
    const r = (n: number) => Math.round(n * 1e4) / 1e4;
    this.progress.loom = {
      uuid: a.uuid,
      x: r(root.position.x),
      y: r(root.position.y),
      z: r(root.position.z),
      yaw: r(root.rotation.y),
      side: this.controller.bankSide,
      source: this.placement.source ?? 'palm',
    };
    saveProgress(this.progress);
  }

  /** Place the loom ~PLACE.forward ahead, centred with the lever bank. */
  private placeLoom(hand: Side, resume?: SavedLoom) {
    const pref = this.settings.hand;
    const side: 1 | -1 = resume && pref === 'auto' ? resume.side : (pref === 'auto' ? hand : pref) === 'left' ? -1 : 1;
    if (!resume && this.settings.placeFresh) {
      // the new spot is set: from now on the loom comes back here
      this.settings = { ...this.settings, placeFresh: false };
      saveSettings(this.settings);
    }
    this.loomSaved = false;
    this.controller.bankSide = side;
    this.debug.bankSide = side;
    this.view.setSide(side);
    this.giftDirty = true; // the present's spot depends on the side and on the table: place it once the loom stands
    this.forwardFlat(this.fwd);
    const root = this.view.root;
    // a new placement is in world space: take the loom back from last session's anchor group first
    if (this.loomHome && root.parent !== this.loomHome) this.loomHome.add(root);
    const palm = this.placement.source === 'palm' || this.placement.source === 'plane' ? { x: this.placement.palmX, z: this.placement.palmZ } : null;
    const pose = loomPose(this.head, this.fwd, side, this.placement.deskY!, palm);
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.set(0, pose.yaw, 0);
    root.visible = true;
    this.holdRing.count = 0;
    root.scale.setScalar(0.05);
    root.updateMatrixWorld(true);
    this.hint.mesh.visible = false;
    this.bloom = 0;
    this.view.setReveal(0);
    this.debug.phase = 'placed';
    this.debug.deskY = this.placement.deskY;
    this.debug.deskSource = this.placement.source;
    this.debug.loomOrigin = root.position.toArray().map((n) => Math.round(n * 1e4) / 1e4);
    // World-lock to the room (optional feature; IWSDK re-parents under its
    // anchor group, preserving this world pose). Feature-detected.
    if (this.world.session?.enabledFeatures?.includes('anchors') && !this.loomEntity.hasComponent(XRAnchor)) {
      this.loomEntity.addComponent(XRAnchor);
    }
    // compile every shader now, while the loom unfolds, so the first plush, confetti or quilt doesn't hitch
    try {
      const r = this.renderer as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> };
      void r.compileAsync?.(this.world.scene, this.world.camera)?.catch(() => {});
    } catch {
      /* not available: shaders compile on first use */
    }
    // welcome back: after a long while away, Pip is asleep on the perch until a hand comes near
    const away = this.progress.lastSeen ? Date.now() - this.progress.lastSeen : 0;
    this.view.pipAsleep = FORCE_SLEEP || (away > SLEEP_AFTER && this.progress.tutorialDone);
    this.asleepFor = 0;
    this.napArmed = false;
    this.markSeen();
    const fallback = this.placement.source === 'default';
    this.controller.nudgeEnabled = fallback;
    this.view.nudges.visible = fallback;
    if (resume) {
      // resumed: the notice comes from tryResume
    } else if (this.coopLink) {
      const host = this.coopLink instanceof CoopHost ? this.coopLink : null;
      this.showNotice(host ? (host.caller ? 'Your caller has the picture: ask them!' : 'Your friend can join on their phone') : 'You throw the shuttle', 6, 'centre');
    }
    else if (this.settings.calibrateNext) this.startCalibration(hand);
    else if (fallback) this.showNotice('Nudge to your desk', 7, 'nudge');
    else if (this.flow.challenge) this.showNotice('Weave this cloth', 6);
    audio.bloom();
  }

  /** Position the tutorial label over its target and pulse that target. */
  private syncHint(dt: number) {
    const step = this.flow.hintStep;
    if (this.laterNoticeIn > 0) {
      this.laterNoticeIn -= dt;
      if (this.laterNoticeIn <= 0) this.showNotice(this.laterNotice, 4, 'centre');
    }
    if (this.unlockNoticeIn > 0) {
      this.unlockNoticeIn -= dt;
      if (this.unlockNoticeIn <= 0) this.showNotice('New style unlocked', 6, 'unlock');
    }
    this.syncGhost(dt, step);
    const m = this.tutor.mesh;
    if (this.hideHints) {
      // capture only: no tags or ghost hand in a still that isn't about them
      m.visible = false;
      this.view.ghost.root.visible = false;
      this.hintsHidden = true;
      return;
    }
    if (this.hintsHidden) {
      this.hintsHidden = false;
      const words = this.notice || this.hintText(this.flow.hintStep);
      this.tutor.set(''); // the label skips an unchanged text: clear it first so it redraws and shows
      this.tutor.set(words); // shows again only if it has words
    }
    if (this.notice) {
      this.noticeTimer -= dt;
      if (this.noticeAt === 'token') m.position.set(0, CARD.baseY + this.view.card.heightM + 0.03, CARD.z); // above the card
      else if (this.noticeAt === 'unlock') m.position.set(tokenX(this.controller.bankSide), 0.06, TOKEN.z);
      else if (this.noticeAt === 'shelf') m.position.set(-this.controller.bankSide * PLUSH.shelfX, 0.115, PLUSH.shelfZ); // over the shelf that's celebrating
      else if (this.noticeAt === 'centre') m.position.set(0, CARD.baseY + this.view.card.heightM + 0.03, CARD.z); // above the card, never over the threads
      else m.position.set(nudgeX(this.controller.bankSide), 0.075, (NUDGE.upZ + NUDGE.downZ) / 2);
      if (this.noticeTimer <= 0) this.showNotice('', 0);
      return;
    }
    this.view.undoHint = 0;
    this.swapGlow = 0;
    this.view.pipBeckon = step === 'shuttle' && this.controller.hover.left === null && this.controller.hover.right === null;
    if (step === 'none') return;
    const side = this.controller.bankSide;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4); // a smooth breath, not an error blink
    if (step === 'lever' || step === 'unlatch') {
      const k = this.hintLever;
      const up = this.model.latched[k];
      // floats right above that very knob, wherever it is (latched knobs sit further back)
      this.controller.leverPos(k, this.tagAt);
      // behind the bank, past the knob's travel: the ghost hand comes down over the knob from the front, so the words never cover it
      m.position.set(this.tagAt.x + side * 0.03, this.tagAt.y + 0.05, (up ? this.tagAt.z : this.tagAt.z - LEVER.travel) - 0.075);
      if (up === (step === 'unlatch')) this.view.setLeverHighlight(k, 0, up, pulse);
    } else if (step === 'friendOn' || step === 'friendOff' || step === 'friendSwap') {
      // over the friend's cushion
      m.position.set(side * FRIEND_SEAT.x, 0.03, FRIEND_SEAT.z + 0.06); // low, in front of the cushion
    } else if (step === 'weft') {
      // the swap spool on Pip's side breathes, with the tag above it
      this.view.swapSpoolPos(this.tagAt);
      m.position.set(this.tagAt.x + this.controller.bankSide * 0.02, 0.03, this.tagAt.z + 0.06); // on the desk in front of the spool, off the perch
      this.swapGlow = pulse;
    } else if (step === 'undo') {
      // the red spool breathes, with the tag above it
      m.position.set(bobbinX(side) + side * 0.045, BOBBIN.y + 0.075, BOBBIN.z + 0.02); // floating over the spool, never on it
      this.view.undoHint = pulse;
    } else if (step === 'shuttle') {
      // Tag hangs just outside the frame beside Pip's perch, never over the threads.
      const end = this.controller.shuttle.t < 0.5 ? -1 : 1;
      m.position.set(end * (SHUTTLE.maxX + 0.02), 0.15, SHUTTLE.z + 0.01); // just above Pip, clear of the hand's fingertips
      if (this.controller.hover.left === null && this.controller.hover.right === null) {
        this.view.setShuttleHighlight(0, pulse);
      }
    } else {
      m.position.set(-side * CARD.x, CARD.baseY + this.view.card.heightM + 0.03, CARD.z);
    }
  }

  private forwardFlat(out: Vector3) {
    this.player.head.getWorldDirection(out);
    // Object3D.getWorldDirection returns +Z; the view looks down -Z.
    out.negate();
    out.y = 0;
    if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
    out.normalize();
    return out;
  }

  private fillInput(side: Side) {
    const h = hands[side];
    const inp = this.handInputs[side];
    inp.tracked = h.tracked;
    inp.pinching = h.pinch.pinching;
    inp.edge = h.edge;
    inp.aperture = h.pinchDist ?? 1;
    this.tmp.copy(h.pinchPoint).applyMatrix4(this.inv);
    copy(inp.pinch, this.tmp);
    this.tmp.copy(h.indexTip).applyMatrix4(this.inv);
    copy(inp.index, this.tmp);
    // Velocity: rotate only (loom has yaw + uniform scale ~1).
    this.tmp.copy(h.indexVel).applyAxisAngle(UPV, -this.view.root.rotation.y);
    copy(inp.indexVel, this.tmp);

    const glow = this.view.glows[side];
    glow.visible = h.tracked;
    glow.position.copy(h.pinchPoint);
    const m = glow.material as { opacity: number };
    m.opacity = h.pinch.pinching ? 0.9 : 0.35;
  }

  private lastHover = [-1, -1];

  private syncView(dt: number) {
    const c = this.controller;
    let hoverK = -1;
    for (let k = 0; k < LEVERS; k++) {
      this.view.setLeverT(k, c.levers[k].t, c.levers[k].held);
      const hov = isTarget(c.hover.left, k) || isTarget(c.hover.right, k);
      const held = isTarget(c.holding.left, k) || isTarget(c.holding.right, k);
      this.view.setLeverHighlight(k, held ? 2 : hov ? 1 : 0, this.model.latched[k]);
      if (hov || held) hoverK = k;
    }
    this.view.setHoverLever(hoverK);
    this.view.basket.hover(Math.max(indexOfKind(c.hover.left, 'skein'), indexOfKind(c.hover.right, 'skein')));
    this.syncPlushSpots();
    this.syncTip(dt);
    if (this.bannerLeft > 0) {
      this.bannerLeft -= dt;
      // it pops in, then floats gently
      const t = this.bannerDur - this.bannerLeft;
      this.banner.mesh.scale.setScalar(t < 0.3 ? 0.4 + 0.6 * (1 - Math.pow(1 - t / 0.3, 3)) * 1.08 : 1);
      this.banner.mesh.position.y = this.bannerY + 0.004 * Math.sin(t * 2.5) * motion.k;
      if (this.bannerLeft <= 0) {
        this.banner.set('');
        this.debug.banner = '';
      }
    }
    for (let i = 0; i < this.sparkleAt.length; i++) {
      if (this.sparkleAt[i] < 0 || this.time < this.sparkleAt[i]) continue;
      this.sparkleAt[i] = -1;
      const p = c.plushSpots[i];
      if (p) this.view.fx.confetti(p.x, p.y + 0.02, p.z, 22, 0.35, true);
    }
    // the finale starts once the last plush has hopped onto the shelf
    if (this.finale && this.flow.phase === 'between' && !this.view.plushes.busy) this.playFinale();
    this.updateGrand(dt);
    this.previewFriend();
    this.autoUndo();
    // while the plush dances on its stage, the plate and token step aside
    const staged = this.view.plushes.staged;
    this.view.plaque.mesh.visible = !staged;
    this.view.token.visible = this.controller.tokenEnabled && !staged;
    // A soft tick whenever a hand starts hovering something new.
    const hl = targetCode(c.hover.left);
    const hr = targetCode(c.hover.right);
    if ((hl >= 0 && hl !== this.lastHover[0]) || (hr >= 0 && hr !== this.lastHover[1])) audio.tick();
    this.lastHover[0] = hl;
    this.lastHover[1] = hr;
    this.view.setShuttleT(c.shuttle.t, dt);
    this.view.setShuttleHighlight(
      isKind(c.holding.left, 'shuttle') || isKind(c.holding.right, 'shuttle') ? 2 : isKind(c.hover.left, 'shuttle') || isKind(c.hover.right, 'shuttle') ? 1 : 0,
    );
    this.view.setBobbinT(c.bobbin.t);
    // the undo spool ratchets as you pull it (a rising tick per fifth of the pull)
    const notch = Math.floor(c.bobbin.t * 5 + 1e-6);
    if (notch > this.undoNotch && notch < 5) audio.ratchet(notch);
    this.undoNotch = notch;
    this.view.setBobbinHighlight(
      isKind(c.holding.left, 'bobbin') || isKind(c.holding.right, 'bobbin') ? 2 : isKind(c.hover.left, 'bobbin') || isKind(c.hover.right, 'bobbin') ? 1 : 0,
    );
    this.view.setTokenHighlight(isKind(c.hover.left, 'token') || isKind(c.hover.right, 'token') ? 1 : 0);
    if (this.tokenPop < 1) {
      // springy pop-in (overshoot), then settle
      this.tokenPop = Math.min(1, this.tokenPop + dt * 2.5);
      const t = this.tokenPop;
      this.view.token.scale.setScalar(TOKEN_SIZE * (1 + Math.sin(t * Math.PI * 2.5) * (1 - t) * 0.6));
    }
    this.view.setPreview(this.model.shed, this.flow.phase === 'play');
    this.syncHint(dt);
    this.view.update(dt);
    this.debug.shed = this.model.shed;
    this.debug.shuttleT = Math.round(c.shuttle.t * 1000) / 1000;
  }
}

const UPV = new Vector3(0, 1, 0);
const HOLD_DOTS = 20;


function mkInput(): HandInput {
  return {
    tracked: false,
    pinching: false,
    edge: 'none',
    pinch: { x: 0, y: 0, z: 0 },
    index: { x: 0, y: 0, z: 0 },
    indexVel: { x: 0, y: 0, z: 0 },
  };
}

function copy(o: { x: number; y: number; z: number }, v: Vector3) {
  o.x = v.x;
  o.y = v.y;
  o.z = v.z;
}

/** Point-in-polygon on the plane's XZ, accepting points within `margin`. */
export function insidePolygon(
  poly: ReadonlyArray<{ x: number; z: number }> | undefined,
  x: number,
  z: number,
  margin: number,
): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  let minD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    // distance to edge
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const l2 = ex * ex + ez * ez || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / l2));
    minD = Math.min(minD, Math.hypot(x - (a.x + t * ex), z - (a.z + t * ez)));
  }
  return inside || minD <= margin;
}

/** Chapter yarn colours (the basket balls). */
const CHAPTER_COLORS: Record<string, number> = { garden: 0x4f9a3a, home: 0xe2563b, night: 0x6b6fb3, sea: 0x2a9d8f };

/** The current chapter's pictures, for the shelf (finished ones become plushes). */
/**
 * The chapter whose shelf stands by the loom: the picture's own, or, for a picture
 * of the day, a bonus pattern or the thank-you, the chapter you've reached.
 */
function shelfChapter(level: Level, progress: Progress): (typeof CHAPTERS)[number] | undefined {
  return CHAPTERS.find((c) => c.id === level.chapter) ?? CHAPTERS.find((c) => c.id === levelAt(Math.min(progress.level, LEVELS.length - 1)).chapter);
}

function shelfItems(level: Level, progress: Progress): ShelfItem[] {
  return chapterShelf(shelfChapter(level, progress), progress);
}

function chapterShelf(ch: (typeof CHAPTERS)[number] | undefined, progress: Progress): ShelfItem[] {
  if (!ch) return [];
  return ch.levels.map((id) => {
    const l = LEVELS.find((x) => x.id === id);
    const done = (progress.best[id] ?? 0) > 0;
    return { id, rows: l?.target ?? [], color: l?.color ?? 0xe2563b, done, placed: done && !!progress.placed?.[id], gold: (progress.best[id] ?? 0) >= 3 };
  });
}

/** Every picture that can become a plush, in desk-spot order: chapters, then pictures of the day. */
const ALL_PICTURES = [...LEVELS, ...DAILY_LEVELS].slice(0, PLUSH.desk);

/** A picture's desk spot index (-1: none). */
function deskIndex(id: string): number {
  return ALL_PICTURES.findIndex((l) => l.id === id);
}

/** Finished plushes living on the desk, by desk index. */
function deskItems(progress: Progress): (DeskItem | null)[] {
  return ALL_PICTURES.map((l) => {
    const at = progress.placed?.[l.id];
    if (!at || !((progress.best[l.id] ?? 0) > 0)) return null;
    return { id: l.id, rows: l.target, color: l.color ?? 0xe2563b, x: at[0], z: at[1], gold: (progress.best[l.id] ?? 0) >= 3 };
  });
}

/** Shelf slot of a picture within its chapter (-1: not a chapter picture). */
function shelfSlot(level: Level): number {
  const ch = CHAPTERS.find((c) => c.id === level.chapter);
  return ch ? ch.levels.indexOf(level.id) : -1;
}

/** Small stable code for a hover target (no allocation): -1 = nothing. */
function targetCode(t: unknown): number {
  const x = t as { kind?: string; k?: number; dir?: number } | null;
  if (!x) return -1;
  switch (x.kind) {
    case 'lever':
      return x.k ?? 0;
    case 'shuttle':
      return 10;
    case 'bobbin':
      return 11;
    case 'token':
      return 12;
    case 'skein':
      return 20 + (x.k ?? (x as { i?: number }).i ?? 0);
    case 'plush':
      return 100 + ((x as { i?: number }).i ?? 0);
    case 'daily':
      return 42;
    case 'cardRow':
      return 60 + ((x as { i?: number }).i ?? 0);
    case 'windKey':
      return 40;
    case 'swap':
      return 41;
    default:
      return 13 + (x.dir ?? 0);
  }
}

function isTarget(t: unknown, k: number): boolean {
  const x = t as { kind?: string; k?: number } | null;
  return !!x && x.kind === 'lever' && x.k === k;
}

/** Stereo position for something at loom-space x (the loom is straight ahead of the seat). */
function panOf(x: number): number {
  return Math.max(-0.85, Math.min(0.85, x / 0.45));
}

/** Is this controller target of the given kind? (module-level: no closure per frame) */
function isKind(t: unknown, kind: string): boolean {
  return (t as { kind?: string } | null)?.kind === kind;
}

/** The index of a target of the given kind, or -1. */
function indexOfKind(t: unknown, kind: string): number {
  const k = t as { kind?: string; i?: number } | null;
  return k?.kind === kind ? (k.i ?? -1) : -1;
}
