/**
 * Shared simulation types. This file is the contract between the engine, content,
 * audio and shell workstreams — change it deliberately and update docs/PLAN.md.
 */

/** A palette index: 0 = darkest … 3 = lightest. Nothing in the game knows real colours. */
export type Shade = 0 | 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Logical handheld buttons. */
export interface Buttons {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  start: boolean;
  select: boolean;
}

export type ButtonName = keyof Buttons;

export const BUTTON_NAMES: readonly ButtonName[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'start',
  'select',
];

/** Input as seen by one fixed simulation tick. */
export interface InputFrame {
  /** Buttons currently down. */
  held: Buttons;
  /** Buttons that went down since the previous tick (includes sub-tick taps). */
  pressed: Buttons;
  /** Buttons that went up since the previous tick. */
  released: Buttons;
}

// ---------------------------------------------------------------------------
// Tiles & levels
// ---------------------------------------------------------------------------

/** Tile ids stored in the level grid (Uint8Array). */
export const Tile = {
  Empty: 0,
  Ground: 1,
  Brick: 2,
  CoinBlock: 3,
  SeedBlock: 4,
  UsedBlock: 5,
  OneWay: 6,
  Spike: 7,
  Hard: 8,
  Glimmer: 9,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export type Theme = 'grass' | 'cave' | 'sky';

export type SpawnKind = 'mossbug' | 'snapper' | 'flutter';

export interface Spawn {
  kind: SpawnKind;
  /** Tile column / row of the glyph in the map. */
  tx: number;
  ty: number;
}

/** A level as authored: an ASCII map plus metadata. See src/game/levels/README legend. */
export interface LevelDef {
  id: string;
  /** Shown on the HUD and intro card, e.g. "1-1". */
  label: string;
  name: string;
  theme: Theme;
  /** Countdown in seconds. */
  timeLimit: number;
  song: SongId;
  /** Rows of equal length; exactly LEVEL_ROWS rows. */
  map: readonly string[];
}

/** A validated, parsed level ready to instantiate. */
export interface ParsedLevel {
  def: LevelDef;
  /** Size in tiles. */
  width: number;
  height: number;
  /** Row-major tile grid, index = ty * width + tx. Treat as immutable; copy per run. */
  tiles: Uint8Array;
  spawns: readonly Spawn[];
  start: { tx: number; ty: number };
  beacon: { tx: number; ty: number };
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

/** Axis-aligned body; x/y are the top-left in world pixels (floats). */
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  onGround: boolean;
}

export type PlayerForm = 'small' | 'bloom';
export type PlayerAnim = 'idle' | 'run' | 'jump' | 'fall' | 'dead' | 'clear';

export interface Player extends Body {
  form: PlayerForm;
  facing: 1 | -1;
  /** Ticks left in which a jump is still allowed after leaving ground. */
  coyote: number;
  /** Ticks left during which a pressed jump will fire on landing. */
  jumpBuffer: number;
  /** True while the current jump is still rising with A held (variable height). */
  jumping: boolean;
  /** Invulnerability ticks remaining after a hit. */
  invuln: number;
  anim: PlayerAnim;
  animTick: number;
  dead: boolean;
}

export type EnemyState = 'walk' | 'squashed' | 'dead';

export interface Enemy extends Body {
  id: number;
  kind: SpawnKind;
  state: EnemyState;
  dir: 1 | -1;
  /** Becomes true once near the camera; inactive enemies do not simulate. */
  active: boolean;
  /** Generic timer in ticks (squash fade, flutter phase, …). */
  timer: number;
  /** Anchor y used by sine flyers. */
  baseY: number;
}

export type ItemKind = 'sunseed' | 'popGlimmer';

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** 'emerging' rises out of a block, 'moving' is live, 'done' is removed next tick. */
  state: 'emerging' | 'moving' | 'done';
  timer: number;
}

/** A block that was hit from below and is playing its bump animation. */
export interface Bump {
  tx: number;
  ty: number;
  timer: number;
}

export interface Particle {
  kind: 'shard' | 'score' | 'sparkle';
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  /** For 'score' particles: points shown. */
  value: number;
}

// ---------------------------------------------------------------------------
// World & events
// ---------------------------------------------------------------------------

export type SceneId =
  'boot' | 'title' | 'intro' | 'playing' | 'paused' | 'dying' | 'gameover' | 'clear' | 'win';

export type SfxId =
  | 'jump'
  | 'coin'
  | 'stomp'
  | 'bump'
  | 'break'
  | 'powerup'
  | 'sprout'
  | 'hurt'
  | 'oneup'
  | 'pause'
  | 'death'
  | 'clear'
  | 'select'
  | 'boot';

export type SongId = 'title' | 'grass' | 'cave' | 'sky' | 'ending';

/** Side effects emitted by a tick for the host (audio, persistence). Cleared every tick. */
export type GameEvent =
  | { kind: 'sfx'; sfx: SfxId }
  | { kind: 'music'; song: SongId | null }
  | { kind: 'highScore'; score: number };

export interface Camera {
  x: number;
  y: number;
}

export interface World {
  seed: number;
  /** PRNG state (see src/engine/prng.ts). */
  rng: number;
  /** Simulation ticks since creation; advances only while simulating. */
  tick: number;
  scene: SceneId;
  /** Ticks spent in the current scene. */
  sceneTick: number;
  /** Ids of levels in play order. */
  levelOrder: readonly string[];
  levelIndex: number;
  level: ParsedLevel;
  /** Mutable copy of level.tiles for this attempt. */
  tiles: Uint8Array;
  player: Player;
  enemies: Enemy[];
  items: Item[];
  bumps: Bump[];
  particles: Particle[];
  camera: Camera;
  score: number;
  coins: number;
  lives: number;
  /** Remaining level time in ticks. */
  timeTicks: number;
  highScore: number;
  musicOn: boolean;
  /** Cursor for menus (game over: 0 = continue, 1 = title). */
  menuIndex: number;
  /** When true, render-side animations are frozen (test mode screenshots). */
  freezeAnim: boolean;
  nextId: number;
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Sprites & font (data provided by the content workstream)
// ---------------------------------------------------------------------------

/** Palette-indexed bitmap. pixels[i] is a Shade or TRANSPARENT. */
export interface Sprite {
  w: number;
  h: number;
  pixels: Uint8Array;
}

export const TRANSPARENT = 255;

export type SpriteId =
  | 'pip_idle'
  | 'pip_run1'
  | 'pip_run2'
  | 'pip_jump'
  | 'pip_fall'
  | 'pip_dead'
  | 'bloom_idle'
  | 'bloom_run1'
  | 'bloom_run2'
  | 'bloom_jump'
  | 'bloom_fall'
  | 'mossbug_walk1'
  | 'mossbug_walk2'
  | 'mossbug_squashed'
  | 'snapper_walk1'
  | 'snapper_walk2'
  | 'flutter_1'
  | 'flutter_2'
  | 'glimmer_1'
  | 'glimmer_2'
  | 'glimmer_3'
  | 'sunseed'
  | 'beacon_top'
  | 'beacon_pole'
  | 'beacon_flag'
  | 'tile_ground_top'
  | 'tile_ground'
  | 'tile_brick'
  | 'tile_block'
  | 'tile_used'
  | 'tile_oneway'
  | 'tile_spike'
  | 'tile_hard'
  | 'shard'
  | 'cloud'
  | 'bush'
  | 'hill'
  | 'stalactite'
  | 'icon_glimmer'
  | 'icon_pip';
