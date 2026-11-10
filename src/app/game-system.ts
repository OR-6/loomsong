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
  type Entity,
  PCFSoftShadowMap,
} from '@iwsdk/core';
import { BOBBIN, CARD, LEVER, LEVERS, LOOM, NUDGE, PLACE, SHUTTLE, TOKEN, WARPS, bobbinX, leverX, nudgeX, tokenX, shuttleY } from '../config.js';
import { applyCalibration, hands, calibration, type Side } from '../input/hands.js';
import { Calibrator } from '../input/calibration.js';
import { LoomController, type HandInput } from '../loom/loom-controller.js';
import { LoomModel } from '../loom/loom-model.js';
import { TOKEN_SIZE, LoomView } from '../loom/loom-view.js';
import { Placement, loomPose } from './placement.js';
import { Label } from '../ui/label.js';
import { audio } from '../audio/synth.js';
import { LevelFlow, TIMING, type HintStep } from './level-flow.js';
import { CHAPTERS, LEVELS, chapterStates, levelAt } from '../puzzle/catalog.js';
import type { Level } from '../puzzle/levels.js';
import { PLUSH, ROW_BEAT, type ShelfItem } from '../loom/plush.js';
import { isLifted } from '../puzzle/tieup.js';
const PLUSH_SLOTS = PLUSH.slots;
import { loadProgress, saveProgress, workshopUnlocked, type Progress } from '../persistence/progress.js';
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

const KNOB_NAMES: Record<number, string> = { 0xe8553e: 'red', 0x1fb3a0: 'teal', 0xe8679e: 'pink', 0x7cc142: 'green' };
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
  none: '',
};

export interface GameDebug {
  phase: string;
  /** Right rows thrown on the music's beat (debug/E2E). */
  onBeat?: number;
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
  private noticeAt: 'token' | 'nudge' | 'centre' | 'unlock' = 'token';
  /** The current chapter's pictures on the shelf (finished ones are pokeable plushes). */
  private shelf: ShelfItem[] = [];
  private singUntil = 0;
  /** Seconds until the 'New style unlocked' tag shows (0: none pending). */
  private unlockNoticeIn = 0;
  /** Lever clicks during a programmatic drop make no sound. */
  private quietLevers = false;
  private undoNotch = 0;
  private plushVecs = Array.from({ length: PLUSH_SLOTS }, () => new Vector3());
  private keyVec = new Vector3();
  private swapVec = { x: 0, y: 0, z: 0 };
  private tagAt = { x: 0, y: 0, z: 0 };
  /** Tutorial/idle breath on the swap spools (0–1). */
  private swapGlow = 0;
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
    this.view.plushes.onLand = () => audio.hop();
    this.view.plushes.onHop = () => audio.pluck(7, 0.6, 0, 0.1);
    this.controller = new LoomController(this.model, {
      pluck: (i, speed) => {
        audio.pluck(i, speed);
        this.view.pluckWarp(i);
        this.debug.plucks++;
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
      windKey: () => this.playShelf(),
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
    this.tutor.mesh.renderOrder = 20;
    this.view.root.add(this.tutor.mesh);
    this.tutor.setTheme(this.shown());
    this.tutor.set('');

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
        // First try of a mystery lever: it takes its colour, with a little chime.
        if (e.latched && this.view.revealLever(e.lever)) audio.reveal();
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
        this.view.card.paper = level.chapter === 'night' ? '#b9beea' : level.chapter === 'sea' ? '#cfeae4' : null;
        this.view.card.sparkles = level.chapter === 'night';
        this.view.card.weft = level.weft ?? null;
        this.view.setWeftColor(level.weft ?? null);
        this.view.card.setPicture(level.color ?? null, level.par);
        this.shelf = shelfItems(level, this.progress);
        this.view.plushes.setShelf(this.shelf, CHAPTERS.find((c) => c.id === level.chapter)?.name ?? '');
        this.syncBasket(level);
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
        this.view.plushes.celebrate(lv.id, lv.target, lv.color ?? this.shown().palette.weft, this.flow.challenge ? -1 : shelfSlot(lv));
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
        this.hintLever = lever;
        this.tutor.set(this.hintText(step));
        if (this.debug) this.debug.hint = step;
      },
      save: (p) => saveProgress(p),
      totals: (stars, level) => {
        this.view.plaque.set(level, stars);
        if (this.debug) this.debug.plaque = `Level ${level + 1} * ${stars}`;
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
    const sess = this.world.session;
    if (!sess) return;
    const hz = sess.frameRate ?? 72;
    const forced = Number.isFinite(this.forcedDegrade) ? this.forcedDegrade : null;
    const lvl = forced ?? this.guard.sample(delta, hz);
    if (lvl === null || lvl === this.debug.degrade) return;
    this.debug.degrade = lvl;
    audio.setReverb(lvl < 1);
    this.view.setShadow(lvl < 1);
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
    if (st.state === 'connected' && coop.transport && !this.coopLink) {
      this.coopTransport = coop.transport;
      this.coopLink = st.role === 'host' ? new CoopHost(side, coop.transport) : new CoopGuest(side, coop.transport);
      this.debug.coop = st.role ?? 'solo';
      if (this.placement.phase === 'placed') {
        this.showNotice(st.role === 'host' ? 'You work the levers' : 'You throw the shuttle', 6, 'centre');
      }
    }
  }

  private endCoop(announce: boolean): void {
    const link = this.coopLink;
    if (!link) return;
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
    const it = this.shelf[i];
    if (!it?.done || this.time < this.singUntil) return;
    audio.resume();
    const secs = this.schedulePictureSong(it.rows, 0);
    this.singUntil = this.time + secs;
    audio.holdMusic(secs + 0.3);
    this.view.plushes.sing(i, secs);
    this.view.setPipMood('happy');
  }

  /** The wind-up key: every finished plush on the shelf sings in turn, left to right (the shelf is a music box). */
  private playShelf(): void {
    if (this.time < this.singUntil) return;
    audio.resume();
    audio.windUp();
    let t = 0.55; // after the winding clicks
    for (let i = 0; i < this.shelf.length; i++) {
      const it = this.shelf[i];
      if (!it?.done) continue;
      const secs = this.schedulePictureSong(it.rows, t);
      this.view.plushes.sing(i, secs, t);
      t += secs + 0.2;
    }
    const total = t;
    this.view.plushes.turnKey(total);
    this.singUntil = this.time + total;
    audio.holdMusic(total + 0.3);
    this.view.setPipMood(total > 0.6 ? 'happy' : 'sad');
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
    c.keySpot = this.coopLink || this.flow?.challenge ? null : this.view.plushes.keyCentre(this.keyVec);
    c.swapSpot = this.flow?.level?.weft && !this.coopLink ? this.view.swapSpoolPos(this.swapVec) : null; // follows the lever side
    const sw = (t: unknown) => (t as { kind?: string } | null)?.kind === 'swap';
    this.view.setSwapHighlight(sw(c.hover.left) || sw(c.hover.right) ? 1 : 0, this.swapGlow);
    const key = (t: unknown) => (t as { kind?: string } | null)?.kind === 'windKey';
    this.view.plushes.hoverKey(key(c.hover.left) || key(c.hover.right));
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

  private showNotice(text: string, seconds: number, at: 'token' | 'nudge' | 'centre' | 'unlock' = 'token'): void {
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
    audio.music(); // the background music box schedules a few notes ahead
    const immersive = this.visibilityState.peek() !== VisibilityState.NonImmersive;
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

  /** Place the loom ~PLACE.forward ahead, centred with the lever bank. */
  private placeLoom(hand: Side) {
    const pref = this.settings.hand;
    const side: 1 | -1 = (pref === 'auto' ? hand : pref) === 'left' ? -1 : 1;
    this.controller.bankSide = side;
    this.debug.bankSide = side;
    this.view.setSide(side);
    this.forwardFlat(this.fwd);
    const root = this.view.root;
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
    if (this.coopLink) this.showNotice(this.coopLink instanceof CoopHost ? 'You work the levers' : 'You throw the shuttle', 6, 'centre');
    else if (this.settings.calibrateNext) this.startCalibration(hand);
    else if (fallback) this.showNotice('Nudge to your desk', 7, 'nudge');
    else if (this.flow.challenge) this.showNotice('Weave this cloth', 6);
    audio.bloom();
  }

  /** Position the tutorial label over its target and pulse that target. */
  private syncHint(dt: number) {
    const step = this.flow.hintStep;
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
      else if (this.noticeAt === 'centre') m.position.set(0, 0.08, 0);
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
      m.position.set(this.tagAt.x, this.tagAt.y + 0.04, this.tagAt.z + 0.004);
      if (up === (step === 'unlatch')) this.view.setLeverHighlight(k, 0, up, pulse);
    } else if (step === 'weft') {
      // the swap spool on Pip's side breathes, with the tag above it
      this.view.swapSpoolPos(this.tagAt);
      m.position.set(this.tagAt.x, this.tagAt.y + 0.05, this.tagAt.z + 0.01);
      this.swapGlow = pulse;
    } else if (step === 'undo') {
      // the red spool breathes, with the tag above it
      m.position.set(bobbinX(side), BOBBIN.y + 0.045, BOBBIN.z + 0.02); // just above the spool it means
      this.view.undoHint = pulse;
    } else if (step === 'shuttle') {
      // Tag hangs just outside the frame beside Pip's perch, never over the threads.
      const end = this.controller.shuttle.t < 0.5 ? -1 : 1;
      m.position.set(end * SHUTTLE.maxX, 0.215, SHUTTLE.z); // well above Pip, clear of the hand's fingertips
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
    return { id, rows: l?.target ?? [], color: l?.color ?? 0xe2563b, done: (progress.best[id] ?? 0) > 0 };
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
      return 30 + ((x as { i?: number }).i ?? 0);
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
