import { START_LIVES, TICK_RATE } from './constants';
import { parseLevel } from './levelParser';
import { updateScene } from './scenes';
import { createPlayer, enterPlaying, enterTitle, loadLevel, startGame } from './scenes/transitions';
import type { InputFrame, LevelDef, SceneId, World } from './types';

export { hashWorld } from './hash';

export interface WorldOptions {
  seed: number;
  /** Levels in play order (at least one). */
  levels: readonly LevelDef[];
  /** Level index a new game starts on (default 0). */
  startIndex?: number;
  highScore: number;
  /** Freeze render-side animations (test-mode screenshots). */
  freezeAnim: boolean;
  /**
   * Scene to start in (default 'boot'). 'title' starts at the title; 'intro' / 'playing' start a
   * new game on `startIndex` directly. Other scenes behave like 'boot'.
   */
  startScene?: SceneId;
}

/**
 * Create a deterministic world. Start-up events (e.g. the title or level song) are left in
 * world.events for the host to dispatch before the first step.
 */
export function createWorld(opts: WorldOptions): World {
  const first = opts.levels[0];
  if (!first) throw new Error('createWorld needs at least one level');
  const level = parseLevel(first);
  const startIndex = opts.startIndex ?? 0;
  const world: World = {
    seed: opts.seed,
    rng: opts.seed | 0,
    tick: 0,
    scene: 'boot',
    sceneTick: 0,
    levels: opts.levels,
    levelIndex: 0,
    level,
    tiles: level.tiles.slice(),
    player: createPlayer(level.start.tx, level.start.ty, 'small'),
    enemies: [],
    items: [],
    bumps: [],
    particles: [],
    camera: { x: 0, y: 0 },
    score: 0,
    coins: 0,
    lives: START_LIVES,
    timeTicks: first.timeLimit * TICK_RATE,
    highScore: opts.highScore,
    musicOn: true,
    menuIndex: 0,
    freezeAnim: opts.freezeAnim,
    nextId: 1,
    events: [],
  };
  switch (opts.startScene) {
    case 'title':
      enterTitle(world);
      break;
    case 'intro':
      startGame(world, startIndex);
      world.events = [];
      break;
    case 'playing':
      startGame(world, startIndex);
      world.events = [];
      enterPlaying(world);
      break;
    default:
      loadLevel(world, startIndex, 'small');
  }
  return world;
}

/**
 * Advance the world by one fixed 1/60 s tick. Mutates and returns `world`. Events from the
 * previous tick are cleared first. `tick` advances in every scene except 'paused'.
 */
export function step(world: World, input: InputFrame): World {
  world.events = [];
  if (world.scene !== 'paused') world.tick++;
  world.sceneTick++;
  updateScene(world, input);
  return world;
}
