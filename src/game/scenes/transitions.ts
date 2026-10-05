import { snapCamera } from '../camera';
import {
  DEATH_POP,
  ENEMY_H,
  ENEMY_W,
  PLAYER_H,
  PLAYER_W,
  START_LIVES,
  TICK_RATE,
  TILE,
} from '../constants';
import { checkHighScore, emitMusic, emitSfx } from '../events';
import { parseLevel } from '../levelParser';
import type { Enemy, Player, PlayerForm, SceneId, Spawn, World } from '../types';

/** A fresh player standing on tile (tx, ty). */
export function createPlayer(tx: number, ty: number, form: PlayerForm): Player {
  return {
    x: tx * TILE + (TILE - PLAYER_W) / 2,
    y: (ty + 1) * TILE - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: true,
    form,
    facing: 1,
    coyote: 0,
    jumpBuffer: 0,
    jumping: false,
    invuln: 0,
    anim: 'idle',
    animTick: 0,
    dead: false,
  };
}

function createEnemy(id: number, s: Spawn): Enemy {
  const y = (s.ty + 1) * TILE - ENEMY_H;
  return {
    id,
    kind: s.kind,
    x: s.tx * TILE + (TILE - ENEMY_W) / 2,
    y,
    w: ENEMY_W,
    h: ENEMY_H,
    vx: 0,
    vy: 0,
    onGround: false,
    state: 'walk',
    dir: -1,
    active: false,
    timer: 0,
    baseY: y,
  };
}

/** Instantiate level `index` for a new attempt: tiles, entities, timer, camera. */
export function loadLevel(world: World, index: number, form: PlayerForm): void {
  const def = world.levels[index];
  if (!def) throw new Error(`No level at index ${index}`);
  const level = parseLevel(def);
  world.levelIndex = index;
  world.level = level;
  world.tiles = level.tiles.slice();
  world.player = createPlayer(level.start.tx, level.start.ty, form);
  world.enemies = level.spawns.map((s) => createEnemy(world.nextId++, s));
  world.items = [];
  world.bumps = [];
  world.particles = [];
  world.timeTicks = def.timeLimit * TICK_RATE;
  snapCamera(world);
}

function setScene(world: World, scene: SceneId): void {
  world.scene = scene;
  world.sceneTick = 0;
}

/** Title screen (level 0 behind it), title song. */
export function enterTitle(world: World): void {
  loadLevel(world, 0, 'small');
  setScene(world, 'title');
  emitMusic(world, 'title');
}

/** Begin a new game from level `index` with fresh lives, score and Glimmers. */
export function startGame(world: World, index: number): void {
  world.score = 0;
  world.coins = 0;
  world.lives = START_LIVES;
  loadLevel(world, index, 'small');
  enterIntro(world);
}

/** The "WORLD x-y" card before an attempt. */
export function enterIntro(world: World): void {
  setScene(world, 'intro');
  emitMusic(world, null);
}

/** Gameplay; starts the level song. */
export function enterPlaying(world: World): void {
  setScene(world, 'playing');
  emitMusic(world, world.level.def.song);
}

/**
 * Pause (only from playing). The level song keeps its place: it is neither stopped here nor
 * restarted on resume, so pausing never rewinds the music to bar 1.
 */
export function enterPaused(world: World): void {
  if (world.scene !== 'playing') return;
  setScene(world, 'paused');
  emitSfx(world, 'pause');
}

/** Resume from pause without re-emitting the level song. */
export function resumePlaying(world: World): void {
  setScene(world, 'playing');
}

/** Pip dies: death jingle, pop-up animation. */
export function enterDying(world: World): void {
  const p = world.player;
  p.dead = true;
  p.anim = 'dead';
  p.animTick = 0;
  p.vx = 0;
  p.vy = -DEATH_POP;
  setScene(world, 'dying');
  emitMusic(world, null);
  emitSfx(world, 'death');
}

/** Out of lives. */
export function enterGameOver(world: World): void {
  setScene(world, 'gameover');
  world.menuIndex = 0;
  emitMusic(world, null);
  checkHighScore(world);
}

/** Pip touched the Beacon. */
export function enterClear(world: World): void {
  const p = world.player;
  const { tx } = world.level.beacon;
  p.x = tx * TILE + TILE / 2 - p.w;
  p.vx = 0;
  p.vy = 0;
  p.jumping = false;
  p.anim = 'clear';
  p.animTick = 0;
  p.facing = 1;
  world.timeTicks = Math.ceil(world.timeTicks / TICK_RATE) * TICK_RATE;
  setScene(world, 'clear');
  emitMusic(world, null);
  emitSfx(world, 'clear');
}

/** Every level cleared. */
export function enterWin(world: World): void {
  setScene(world, 'win');
  emitMusic(world, 'ending');
  checkHighScore(world);
}
