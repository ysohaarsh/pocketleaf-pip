/**
 * Every tuning value lives here, with units. The engine workstream owns tuning;
 * content uses the reach numbers to design jumps that are always possible.
 */

// --- Screen & grid -----------------------------------------------------------
/** Internal resolution in pixels. */
export const SCREEN_W = 160;
export const SCREEN_H = 144;
/** Tile size in pixels; the screen is 10x9 tiles. */
export const TILE = 16;
/** Every level map has exactly this many rows. */
export const LEVEL_ROWS = 9;

// --- Timing ------------------------------------------------------------------
/** Fixed simulation rate (ticks per second) and step in seconds. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Longest real frame we simulate (s) and max catch-up steps per frame. */
export const MAX_FRAME_TIME = 0.25;
export const MAX_STEPS_PER_FRAME = 5;

// --- Player movement (px/s, px/s^2) -----------------------------------------
export const WALK_SPEED = 90;
export const RUN_SPEED = 140;
/** Ground acceleration: reaches walk speed in ~0.15 s. */
export const GROUND_ACCEL = 600;
export const GROUND_DECEL = 900;
/** Extra decel when pressing against current motion (skid). */
export const TURN_DECEL = 1400;
export const AIR_ACCEL = 420;
export const AIR_DECEL = 250;

// --- Jumping -----------------------------------------------------------------
/** Initial jump velocity (px/s, upward). v^2 / (2 * GRAVITY_UP) ≈ 56 px = 3.5 tiles. */
export const JUMP_VELOCITY = 300;
/** Gravity while rising with A held (px/s^2). */
export const GRAVITY_UP = 800;
/** Gravity while falling (px/s^2). */
export const GRAVITY_DOWN = 1300;
/** Max fall speed (px/s); 330/60 = 5.5 px per tick < TILE, so no tunnelling. */
export const TERMINAL_VELOCITY = 330;
/** Upward velocity multiplier when A is released mid-rise. */
export const JUMP_CUT = 0.5;
/** Coyote time and jump buffer, in ticks (100 ms). */
export const COYOTE_TICKS = 6;
export const JUMP_BUFFER_TICKS = 6;
/** Bounce velocity after stomping an enemy (px/s, upward). */
export const STOMP_BOUNCE = 220;

// --- Player body ------------------------------------------------------------
/** Hitbox in px (same for both forms; Bloom shows a leaf crown above it). */
export const PLAYER_W = 10;
export const PLAYER_H = 14;
/** Invulnerability after being hit (ticks). */
export const HURT_INVULN_TICKS = 120;

// --- Enemies & items (px/s) ---------------------------------------------------
export const MOSSBUG_SPEED = 24;
export const SNAPPER_SPEED = 30;
export const FLUTTER_SPEED = 28;
/** Flutter vertical amplitude (px) and period (ticks). */
export const FLUTTER_AMPLITUDE = 12;
export const FLUTTER_PERIOD = 120;
export const SEED_SPEED = 40;
/** Enemies activate when within this many px of the camera's edges. */
export const ACTIVATE_MARGIN = 32;

// --- Camera ------------------------------------------------------------------
/** Horizontal deadzone around screen centre (px) and look-ahead in facing direction (px). */
export const CAMERA_DEADZONE = 16;
export const CAMERA_LOOKAHEAD = 16;

// --- Scoring -----------------------------------------------------------------
export const SCORE_GLIMMER = 100;
export const SCORE_STOMP = 200;
export const SCORE_SEED = 1000;
export const SCORE_BRICK = 50;
/** Points per remaining second at the Beacon. */
export const SCORE_TIME_BONUS = 10;
export const GLIMMERS_PER_LIFE = 100;
export const START_LIVES = 3;

// --- Scenes (ticks) ----------------------------------------------------------
export const BOOT_TICKS = 120;
export const INTRO_TICKS = 150;
export const DYING_TICKS = 150;
export const CLEAR_TICKS = 240;
