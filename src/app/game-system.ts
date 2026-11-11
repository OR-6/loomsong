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
  VisibilityState,
  XRAnchor,
  XRPlane,
  SceneUnderstandingSystem,
  type Object3D,
  type Entity,
  PCFSoftShadowMap,
} from '@iwsdk/core';
import { BASKET, BOBBIN, CARD, LEVER, LEVERS, LOOM, NUDGE, PLACE, SHUTTLE, TOKEN, WARPS, bobbinX, leverX, nudgeX, skeinPos, tokenX, shuttleY } from '../config.js';
import { applyCalibration, hands, calibration, type Side } from '../input/hands.js';
import { Calibrator } from '../input/calibration.js';
import { LoomController, type HandInput } from '../loom/loom-controller.js';
import { LoomModel } from '../loom/loom-model.js';
import { TOKEN_SIZE, LoomView } from '../loom/loom-view.js';
import { Placement, loomPose } from './placement.js';
import { Label } from '../ui/label.js';
import { audio } from '../audio/synth.js';
import { LevelFlow, TIMING, type HintStep } from './level-flow.js';
import { CHAPTERS, DAILY_LEVELS, LEVELS, chapterStates, dailyLevel, dayKey, levelAt, pictureById, streakOf } from '../puzzle/catalog.js';
import type { Level } from '../puzzle/levels.js';
import { PLUSH, ROW_BEAT, SPOTS, type DeskItem, type ShelfItem } from '../loom/plush.js';
import { DAILY_BALL } from '../loom/daily-ball.js';
import { isLifted } from '../puzzle/tieup.js';
const PLUSH_SLOTS = SPOTS;
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

const KNOB_NAMES: Record<number, string> = { 0xe8553e: 'red', 0x1fb3a0: 'teal', 0xf2b632: 'yellow', 0x7b5bb8: 'purple' };
const ORDINAL = ['first', 'second', 'third', 'fourth'];

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
  more: 'This row needs more threads',
  none: '',
};

export interface GameDebug {
  phase: string;
  /** Right rows thrown on the music's beat (debug/E2E). */
  onBeat?: number;
  /** The celebration ribbon's text ('' when hidden). */
  banner?: string;
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
  /** The loom's pose is saved under the room anchor for this placement. */
  private loomSaved = false;
  /** The loom's own parent before the room anchor takes it. */
  private loomHome: Object3D | null = null;
  /** This session's loom came back from the last one. */
  private resumed = false;
  private medleyOrder: number[] = [];
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
  /** Today's key and whether its picture is woven (refreshed on each level load). */
  private today = '';
  private dailyDone = false;
  private dailyVec = new Vector3();
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
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // (No tone mapping: filmic curves washed the toy palette into pastels.)
    this.view = new LoomView(this.shown());
    if (NO_SHADOWS) this.view.setShadow(false); // `?shadows=0`: compare frame times on the headset
    this.view.plushes.onLand = () => audio.hop();
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
      plush: (i) => this.singPlush(i),
      carry: (i, p) => this.view.plushes.carry(i, p),
      drop: (i, p) => this.dropPlush(i, p),
      windKey: () => this.playShelf(),
      daily: () => this.startDaily(),
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
    const onSettings = () => {
      this.settings = loadSettings();
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
      if (e.type === 'row' || e.type === 'undo' || e.type === 'sync') this.view.setRows(this.model.rows);
      // Pip reacts to each row: a happy hop and wink, or a droop.
      if (e.type === 'row' && this.flow?.level) {
        const good = e.row === this.flow.level.target[e.index];
        this.view.setPipMood(good ? 'happy' : 'sad');
        this.view.rowVerdict(good);
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
        this.view.setPicture(level.color ?? null, level.tieUp, level.tieUp.map(() => !!level.mystery));
        this.view.setTarget(level.target);
        this.view.card.paper = level.chapter === 'night' ? '#b9beea' : null; // Sea stays cream so its blue water rows read
        this.view.card.sparkles = false;
        this.view.card.weft = level.weft ?? null;
        this.view.setWeftColor(level.weft ?? null);
        this.view.card.setPicture(level.color ?? null, level.par);
        this.view.plaque.set(level.name);
        if (this.debug) this.debug.plaque = level.name;
        this.shelf = shelfItems(level, this.progress);
        this.view.plushes.setShelf(this.shelf, CHAPTERS.find((c) => c.id === level.chapter)?.name ?? '');
        this.view.plushes.setDesk(deskItems(this.progress));
        this.syncDaily();
        this.syncBasket(level);
        // the very first picture keeps the desk quiet: no shelf, no basket until there's something to show
        const fresh = !this.progress.tutorialDone && !Object.values(this.progress.best).some((v) => v > 0);
        this.view.plushes.showShelf(!fresh);
        this.view.basket.root.visible = !fresh;
        if (fresh) this.controller.skeins = 0;
        this.view.setShed(0, true);
        this.view.setRows(this.model.rows);
        this.view.setGlowRow(-1);
        audio.setRoot(level.rootMidi);
        audio.setMood(level.chapter ?? 'garden');
        if (this.debug) {
          this.debug.level = level.id;
          this.debug.levelIndex = this.flow?.index ?? 0;
        }
      },
      status: (level, statuses, stars) => {
        this.view.card.draw(level.name, level.target, statuses, stars, this.settings.highContrast);
        this.view.placeCard();
      },
      win: (stars) => {
        this.controller.enabled = false;
        this.view.setPipMood('cheer');
        this.view.fx.confetti(0, 0.02, LOOM.clothFrontZ - 0.04, 160);
        audio.chirp('cheer');
        // It comes alive: the woven picture pops out as a plush.
        const lv = this.flow.level;
        this.view.plushes.celebrate(lv.id, lv.target, lv.color ?? this.shown().palette.weft, this.heroSpot(lv));
        if (!this.view.plushes.shelfShown) this.view.plushes.showShelf(true, true); // the shelf springs up for the first plush
        // the next picture waits for the whole show: pop, dance (at least PLUSH.minDance), bow, hop
        const songEnd = TIMING.winPause + lv.target.length * TIMING.rowTime;
        const showEnd = Math.max(songEnd, 0.95 + PLUSH.minDance) + 0.8 + 0.75;
        this.flow.extraBetween = Math.max(0, showEnd + 0.3 - (songEnd + TIMING.afterPlayback));
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
    if (shared) this.flow.startChallenge(clothLevel(shared));
    else this.flow.start();
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
      photo: (on: boolean) => this.view.photoSet(on),
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
          this.setCallerGap(true);
          this.showNotice('Your caller has the picture: ask them!', 6, 'centre');
        };
      }
      if (this.placement.phase === 'placed') {
        this.showNotice(st.role === 'host' ? 'You work the levers' : 'You throw the shuttle', 6, 'centre');
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
  /** The tag's words: levers by their colour ("Lift the red lever"); in the tutorial the card hint states the goal once. */
  private hintText(step: HintStep): string {
    if (step === 'card' && this.flow?.tutorial) return 'Weave each row like the card';
    if (step === 'lever' || step === 'unlatch') {
      const name = this.leverName(this.hintLever);
      return step === 'lever' ? `Lift the ${name} lever` : `Put the ${name} lever back`;
    }
    return HINT_TEXT[step];
  }

  /** A lever's spoken name: its knob colour, or its place when colours don't tell them apart (brass, mystery). */
  private leverName(k: number): string {
    const knobs = this.shown().palette.knobs;
    const same = knobs.every((c) => c === knobs[0]);
    if (same || this.flow?.level?.mystery) return ORDINAL[k] ?? 'next';
    return KNOB_NAMES[knobs[k]] ?? ORDINAL[k] ?? 'next';
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
    ghost.show(
      this.notice
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

  /** Schedule a picture's song `delay` s from now (a row per hop, rows alternating like the weaving); returns its length. */
  private schedulePictureSong(rows: readonly number[], delay: number): number {
    for (let r = 0; r < rows.length; r++) {
      const ltr = r % 2 === 0;
      let k = 0;
      for (let j = 0; j < WARPS; j++) {
        const w = ltr ? j : WARPS - 1 - j;
        if (isLifted(rows[r], w)) audio.pluck(w, 0.35, delay + r * ROW_BEAT + k++ * 0.045, 0.24);
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
    const secs = this.schedulePictureSong(lv.target, 0);
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
    this.banner.set(`${f.chapter} complete!`);
    this.banner.mesh.position.set(-this.controller.bankSide * PLUSH.shelfX, 0.13, PLUSH.shelfZ);
    this.banner.mesh.visible = true;
    this.bannerLeft = this.bannerDur = 6;
    this.bannerY = 0.13;
    this.debug.banner = `${f.chapter} complete!`;
  }

  /** The wind-up key: every finished plush on the shelf sings in turn, left to right (the shelf is a music box). */
  private playShelf(): void {
    if (this.time < this.singUntil) return;
    audio.resume();
    audio.windUp();
    let t = 0.55; // after the winding clicks
    // every plush plays, shelf and desk alike, left to right as they stand: arranging them composes the tune
    const order = this.medleyOrder;
    order.length = 0;
    for (let i = 0; i < SPOTS; i++) if (this.view.plushes.idAt(i) && this.view.plushes.plushCentre(i, this.plushVecs[i])) order.push(i);
    order.sort((a, b) => this.plushVecs[a].x - this.plushVecs[b].x);
    for (const i of order) {
      const lv = pictureById(this.view.plushes.idAt(i) ?? '');
      if (!lv) continue;
      const secs = this.schedulePictureSong(lv.target, t);
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

  /** The picture-of-the-day ball: offered once the first picture is woven, hidden while today's is on the loom. */
  private syncDaily(): void {
    this.today = dayKey();
    this.dailyDone = (this.progress.days ?? []).includes(this.today);
    const offered = this.progress.tutorialDone && !this.coopLink && !this.flow?.daily;
    const lv = dailyLevel(this.today);
    this.view.daily.set(offered ? (this.dailyDone ? 'done' : 'new') : 'hidden', lv.color ?? 0xe2563b);
    const side = this.controller.bankSide;
    this.dailyVec.set(-side * DAILY_BALL.x, DAILY_BALL.y, DAILY_BALL.z);
  }

  /** Weave today's picture (once a day; the ball says when the next one comes). */
  private startDaily(): void {
    if (this.flow.phase !== 'play' || this.coopLink || this.flow.daily) return;
    this.syncDaily();
    if (this.dailyDone) {
      audio.tick();
      this.showNotice('A new picture tomorrow', 3, 'centre');
      return;
    }
    const lv = dailyLevel(this.today);
    audio.restyle();
    this.flow.startChallenge(lv, this.today);
    this.showNotice(`Today: ${lv.name}`, 3, 'centre');
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
      if (!this.onTable({ x, y: 0.01, z })) continue;
      return [x, z];
    }
    return null;
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
    const slot = this.shelf.findIndex((it) => it.id === id);
    const side = this.controller.bankSide;
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
    if (d < 0 || nearShelf || inLoom || inBank || inBasket || onPlaque || tooHigh || !this.onTable(p)) {
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
    const pl = (t: unknown) => ((t as { kind?: string; i?: number } | null)?.kind === 'plush' ? (t as { i: number }).i : -1);
    this.view.plushes.hover(Math.max(pl(c.hover.left), pl(c.hover.right)));
    c.keySpot = this.coopLink || this.flow?.challenge || !this.view.plushes.shelfShown ? null : this.view.plushes.keyCentre(this.keyVec);
    c.swapSpot = this.flow?.level?.weft && !this.coopLink ? this.view.swapSpoolPos(this.swapVec) : null; // follows the lever side
    const sw = (t: unknown) => (t as { kind?: string } | null)?.kind === 'swap';
    this.view.setSwapHighlight(sw(c.hover.left) || sw(c.hover.right) ? 1 : 0, this.swapGlow);
    const key = (t: unknown) => (t as { kind?: string } | null)?.kind === 'windKey';
    this.view.plushes.hoverKey(key(c.hover.left) || key(c.hover.right));
    c.dailySpot = this.view.daily.root.visible && this.flow?.phase === 'play' ? this.dailyVec : null;
    const dy = (t: unknown) => (t as { kind?: string } | null)?.kind === 'daily';
    this.view.daily.hover(dy(c.hover.left) || dy(c.hover.right));
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
    if (!ch || this.flow.phase !== 'play' || this.coopLink) return;
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
    this.time += dt;
    this.syncView(dt);
    this.debug.flow = this.flow.phase;
    this.debug.challenge = this.flow.challenge;
    this.debug.anchored = this.loomEntity.hasComponent(XRAnchor) && this.loomEntity.getValue(XRAnchor, 'attached') === true;
    if (this.debug.anchored) this.saveLoomPose();
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
    const fallback = this.placement.source === 'default';
    this.controller.nudgeEnabled = fallback;
    this.view.nudges.visible = fallback;
    if (resume) {
      // resumed: the notice comes from tryResume
    } else if (this.coopLink) this.showNotice(this.coopLink instanceof CoopHost ? 'You work the levers' : 'You throw the shuttle', 6, 'centre');
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
    if (step === 'none') return;
    const side = this.controller.bankSide;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4); // a smooth breath, not an error blink
    if (step === 'lever' || step === 'unlatch') {
      const k = this.hintLever;
      const up = this.model.latched[k];
      // floats right above that very knob, wherever it is (latched knobs sit further back)
      this.controller.leverPos(k, this.tagAt);
      m.position.set(this.tagAt.x + side * 0.05, this.tagAt.y + 0.075, this.tagAt.z); // high over that knob, nudged into the box (clear of Pip)
      if (up === (step === 'unlatch')) this.view.setLeverHighlight(k, 0, up, pulse);
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
    const sk = (t: unknown) => ((t as { kind?: string; i?: number } | null)?.kind === 'skein' ? (t as { i: number }).i : -1);
    this.view.basket.hover(Math.max(sk(c.hover.left), sk(c.hover.right)));
    this.syncPlushSpots();
    this.syncTip(dt);
    if (this.bannerLeft > 0) {
      this.bannerLeft -= dt;
      // it pops in, then floats gently
      const t = this.bannerDur - this.bannerLeft;
      this.banner.mesh.scale.setScalar(t < 0.3 ? 0.4 + 0.6 * (1 - Math.pow(1 - t / 0.3, 3)) * 1.08 : 1);
      this.banner.mesh.position.y = this.bannerY + 0.004 * Math.sin(t * 2.5);
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
    const sh = (t: unknown) => (t as { kind?: string } | null)?.kind === 'shuttle';
    this.view.setShuttleHighlight(
      sh(c.holding.left) || sh(c.holding.right) ? 2 : sh(c.hover.left) || sh(c.hover.right) ? 1 : 0,
    );
    const bob = (t: unknown) => (t as { kind?: string } | null)?.kind === 'bobbin';
    this.view.setBobbinT(c.bobbin.t);
    // the undo spool ratchets as you pull it (a rising tick per fifth of the pull)
    const notch = Math.floor(c.bobbin.t * 5 + 1e-6);
    if (notch > this.undoNotch && notch < 5) audio.ratchet(notch);
    this.undoNotch = notch;
    this.view.setBobbinHighlight(
      bob(c.holding.left) || bob(c.holding.right) ? 2 : bob(c.hover.left) || bob(c.hover.right) ? 1 : 0,
    );
    const tok = (t: unknown) => (t as { kind?: string } | null)?.kind === 'token';
    this.view.setTokenHighlight(tok(c.hover.left) || tok(c.hover.right) ? 1 : 0);
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
function shelfItems(level: Level, progress: Progress): ShelfItem[] {
  const ch = CHAPTERS.find((c) => c.id === level.chapter);
  if (!ch) return [];
  return ch.levels.map((id) => {
    const l = LEVELS.find((x) => x.id === id);
    const done = (progress.best[id] ?? 0) > 0;
    return { id, rows: l?.target ?? [], color: l?.color ?? 0xe2563b, done, placed: done && !!progress.placed?.[id] };
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
    return { id: l.id, rows: l.target, color: l.color ?? 0xe2563b, x: at[0], z: at[1] };
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
