import type { AudioEngine } from '../audio/types';
import { installTestHooks } from '../debug/testHooks';
import { BOOT_CHIME_TICK, SCREEN_H, SCREEN_W } from '../game/constants';
import { LEVELS, TEST_LEVELS } from '../game/levels';
import { checkHighScore } from '../game/events';
import { enterPaused } from '../game/scenes/transitions';
import type { GameEvent, LevelDef, SceneId, Shade, SongId, World } from '../game/types';
import { createWorld, step } from '../game/world';
import { createGamepadPoller, type PadLike } from '../input/gamepad';
import { InputHub } from '../input/InputState';
import { attachKeyboard } from '../input/keyboard';
import {
  DEFAULT_SETTINGS,
  PALETTES,
  type GameHost,
  type GameSnapshot,
  type HostOptions,
  type Settings,
} from './api';
import { createBlitter, type Blitter } from './blit';
import { createLoop } from './loop';
import { rasterize } from './renderer';

/** localStorage key of the persisted high score. */
export const HIGH_SCORE_KEY = 'pocketleaf.highscore';
/** How long a toast stays up (ms). */
const TOAST_MS = 2000;
/** Shade shown while powered off. */
const OFF_SHADE: Shade = 1;
/** Boot starts this far in with reduced motion (just before the chime). */
const REDUCED_BOOT_TICK = BOOT_CHIME_TICK - 10;
/** Extra frames presented after the last change so LCD ghosting settles. */
const GHOST_SETTLE_FRAMES = 12;
/** Scenes that move on to 'playing' (directly or via the intro card) without any input. */
const LEADS_TO_PLAY: ReadonlySet<SceneId> = new Set<SceneId>(['intro', 'dying', 'clear']);

interface LevelPlan {
  levels: readonly LevelDef[];
  startIndex: number;
  startScene: SceneId;
}

/** Campaign by default; ?level=<campaign id> starts there; test levels only in test mode. */
export function planLevels(levelOverride: string | null, test: boolean): LevelPlan {
  if (levelOverride) {
    const idx = LEVELS.findIndex((l) => l.id === levelOverride);
    if (idx >= 0) return { levels: LEVELS, startIndex: idx, startScene: 'playing' };
    const testLevel = test ? TEST_LEVELS[levelOverride] : undefined;
    if (testLevel) return { levels: [testLevel], startIndex: 0, startScene: 'playing' };
  }
  return { levels: LEVELS, startIndex: 0, startScene: 'boot' };
}

function readHighScore(storage: HostOptions['storage']): number {
  try {
    const n = parseInt(storage?.getItem(HIGH_SCORE_KEY) ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Gamepads from the API plus any announced only through gamepadconnected events. */
function createPadSource(): { getPads: () => readonly (PadLike | null)[]; dispose: () => void } {
  const announced = new Map<number, PadLike>();
  const padOf = (e: Event): PadLike | undefined => (e as Event & { gamepad?: PadLike }).gamepad;
  const onConnect = (e: Event): void => {
    const pad = padOf(e);
    if (pad) announced.set(pad.index, pad);
  };
  const onDisconnect = (e: Event): void => {
    const pad = padOf(e);
    if (pad) announced.delete(pad.index);
  };
  window.addEventListener('gamepadconnected', onConnect);
  window.addEventListener('gamepaddisconnected', onDisconnect);
  return {
    getPads() {
      const list: (PadLike | null)[] =
        typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()] : [];
      const seen = new Set(list.flatMap((p) => (p ? [p.index] : [])));
      for (const [i, pad] of announced) if (!seen.has(i)) list.push(pad);
      return list;
    },
    dispose() {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    },
  };
}

/**
 * The engine host: owns the world, the fixed-step loop, input sources, rendering and audio
 * dispatch. React only talks to it through the GameHost contract.
 */
export function createGameHost(opts: HostOptions, audio: AudioEngine): GameHost {
  const input = new InputHub();
  const plan = planLevels(opts.levelOverride, opts.test);
  const fb = new Uint8Array(SCREEN_W * SCREEN_H);
  const listeners = new Set<() => void>();
  // Test mode starts with LCD effects off for deterministic pixels; setSettings may enable them.
  let settings: Settings = { ...DEFAULT_SETTINGS, lcd: DEFAULT_SETTINGS.lcd && !opts.test };
  let powered = true;
  let toast: string | null = null;
  let toastUntil = 0;
  let canvas: HTMLCanvasElement | null = null;
  let blitter: Blitter | null = null;
  let lastSize: [number, number, number] | null = null;
  let dirty = true;
  let settleFrames = 0;
  let song: SongId | null = null;

  const safely = (fn: () => void): void => {
    try {
      fn();
    } catch {
      // Audio/storage failures must never break the game loop.
    }
  };

  const dispatch = (events: readonly GameEvent[]): void => {
    for (const ev of events) {
      if (ev.kind === 'sfx') safely(() => audio.playSfx(ev.sfx));
      else if (ev.kind === 'music') {
        song = ev.song;
        safely(() => audio.playMusic(world.musicOn ? ev.song : null));
      } else safely(() => opts.storage?.setItem(HIGH_SCORE_KEY, String(ev.score)));
    }
  };

  const newWorld = (): World => {
    const w = createWorld({
      seed: opts.seed,
      levels: plan.levels,
      startIndex: plan.startIndex,
      highScore: readHighScore(opts.storage),
      freezeAnim: opts.test,
      startScene: plan.startScene,
    });
    if (opts.reducedMotion && w.scene === 'boot') w.sceneTick = REDUCED_BOOT_TICK;
    return w;
  };

  let world = newWorld();
  dispatch(world.events);
  world.events = [];

  let snapshot: GameSnapshot = { powered, scene: world.scene, toast };
  const publish = (): void => {
    if (snapshot.powered === powered && snapshot.scene === world.scene && snapshot.toast === toast)
      return;
    snapshot = { powered, scene: world.scene, toast };
    for (const l of listeners) l();
  };

  const palette = (): readonly string[] => PALETTES[settings.palette];
  const lcdOn = (): boolean => settings.lcd && !opts.reducedMotion;
  const showOff = (): void => {
    if (!blitter || !canvas) return;
    blitter.clear(OFF_SHADE, palette());
    canvas.dataset.ready = '1';
  };

  const unlockAudio = (): void => {
    if (audio.unlocked) return;
    safely(() => {
      audio
        .unlock()
        .then(() => safely(() => audio.playMusic(world.musicOn ? song : null)))
        .catch(() => undefined);
    });
  };

  const setToast = (text: string): void => {
    toast = text;
    toastUntil = performance.now() + TOAST_MS;
    publish();
  };

  const pads = createPadSource();
  const gamepad = createGamepadPoller(input, pads.getPads, {
    onConnect: () => setToast('Controller connected'),
    onDisconnect: () => setToast('Controller disconnected'),
  });

  const loop = createLoop({
    beforeSteps: () => {
      if (gamepad.poll()) unlockAudio();
    },
    step: () => {
      const before = world.scene;
      step(world, input.sample());
      dispatch(world.events);
      if (pauseQueued && !LEADS_TO_PLAY.has(world.scene)) {
        pauseQueued = false;
        if (world.scene === 'playing') requestPause();
      }
      if (world.scene !== 'paused' || before !== 'paused') dirty = true;
      if (world.scene !== before) publish();
    },
    render: () => {
      if (toast !== null && performance.now() >= toastUntil) {
        toast = null;
        publish();
      }
      if (!blitter || !canvas) return;
      if (dirty) settleFrames = lcdOn() ? GHOST_SETTLE_FRAMES : 0;
      else if (settleFrames-- <= 0) return;
      if (dirty) rasterize(world, fb);
      dirty = false;
      blitter.present(fb, palette(), lcdOn());
      if (canvas.dataset.ready !== '1') canvas.dataset.ready = '1';
    },
  });

  /**
   * A blur during a scene that hands over to play on its own (intro card, dying, Beacon clear)
   * pauses as soon as play begins, so play never starts unattended.
   */
  let pauseQueued = false;
  const requestPause = (): void => {
    if (powered && LEADS_TO_PLAY.has(world.scene)) pauseQueued = true;
    if (!powered || world.scene !== 'playing') return;
    world.events = [];
    enterPaused(world);
    dispatch(world.events);
    world.events = [];
    dirty = true;
    publish();
  };

  const onBlur = (): void => {
    input.clearAll();
    requestPause();
  };
  const onVisibility = (): void => {
    if (document.hidden) onBlur();
  };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  const detachKeyboard = attachKeyboard(input, window);
  const uninstallHooks =
    opts.test || import.meta.env.DEV
      ? installTestHooks(
          () => world,
          () => loop.stats(),
        )
      : () => undefined;

  return {
    input,
    attachCanvas(c) {
      canvas = c;
      blitter = createBlitter(c);
      if (lastSize) blitter.resize(...lastSize);
      dirty = true;
      if (powered) loop.start();
      else showOff();
    },
    resize(cssWidth, cssHeight, dpr) {
      lastSize = [cssWidth, cssHeight, dpr];
      blitter?.resize(cssWidth, cssHeight, dpr);
      dirty = true;
      if (!powered) showOff();
    },
    setPowered(on) {
      if (on === powered) return;
      powered = on;
      if (on) {
        world = newWorld();
        dispatch(world.events);
        world.events = [];
        // Drop presses made while off so they cannot skip the fresh boot screen.
        input.sample();
        dirty = true;
        if (canvas) loop.start();
      } else {
        // Powering off mid-game still records a new high score.
        world.events = [];
        checkHighScore(world);
        dispatch(world.events);
        world.events = [];
        loop.stop();
        input.clearAll();
        safely(() => audio.playMusic(null));
        toast = null;
        showOff();
      }
      publish();
    },
    setSettings(s) {
      settings = { ...s };
      safely(() => audio.setVolume(s.volume));
      safely(() => audio.setMuted(s.muted));
      dirty = true;
      if (!powered) showOff();
    },
    requestPause,
    unlockAudio,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    destroy() {
      loop.stop();
      detachKeyboard();
      pads.dispose();
      uninstallHooks();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      safely(() => audio.playMusic(null));
      listeners.clear();
    },
  };
}
