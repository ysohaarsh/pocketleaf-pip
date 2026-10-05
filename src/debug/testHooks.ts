import { TICK_RATE } from '../game/constants';
import type { PlayerForm, SceneId, World } from '../game/types';
import type { LoopStats } from '../engine/loop';

/** Long tasks above this many ms are counted. */
const LONG_TASK_MS = 50;

export interface GameTestApi {
  readonly scene: SceneId;
  readonly tick: number;
  readonly player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    form: PlayerForm;
    onGround: boolean;
  };
  readonly coins: number;
  readonly score: number;
  readonly lives: number;
  readonly levelId: string;
  /** Remaining level time in whole seconds. */
  readonly timeLeft: number;
  readonly stats: LoopStats & { longTasks: number };
  /** A deep copy of the current world. */
  world(): World;
}

declare global {
  interface Window {
    __GAME__?: GameTestApi;
  }
}

/**
 * Expose window.__GAME__ for e2e tests (dev or ?test=1 only). `getWorld` is read on every access so
 * the hooks follow world re-creation (power cycles). Returns an uninstall function.
 */
export function installTestHooks(getWorld: () => World, getStats: () => LoopStats): () => void {
  let longTasks = 0;
  let observer: PerformanceObserver | null = null;
  if (
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('longtask')
  ) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.duration > LONG_TASK_MS) longTasks++;
    });
    observer.observe({ type: 'longtask', buffered: true });
  }
  const api: GameTestApi = {
    get scene() {
      return getWorld().scene;
    },
    get tick() {
      return getWorld().tick;
    },
    get player() {
      const p = getWorld().player;
      return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, form: p.form, onGround: p.onGround };
    },
    get coins() {
      return getWorld().coins;
    },
    get score() {
      return getWorld().score;
    },
    get lives() {
      return getWorld().lives;
    },
    get levelId() {
      return getWorld().level.def.id;
    },
    get timeLeft() {
      return Math.ceil(getWorld().timeTicks / TICK_RATE);
    },
    get stats() {
      return { ...getStats(), longTasks };
    },
    world: () => structuredClone(getWorld()),
  };
  window.__GAME__ = api;
  return () => {
    observer?.disconnect();
    if (window.__GAME__ === api) delete window.__GAME__;
  };
}
