import {
  AIR_ACCEL,
  AIR_DECEL,
  COYOTE_TICKS,
  DT,
  GRAVITY_DOWN,
  GRAVITY_UP,
  GROUND_ACCEL,
  GROUND_DECEL,
  JUMP_BUFFER_TICKS,
  JUMP_CUT,
  JUMP_MIN_TICKS,
  JUMP_VELOCITY,
  RUN_SPEED,
  TERMINAL_VELOCITY,
  TURN_DECEL,
  WALK_SPEED,
} from './constants';
import type { Buttons, Player } from './types';

/** Upward speed below which an early A release may cut the jump (after JUMP_MIN_TICKS of rise). */
const CUT_SPEED = JUMP_VELOCITY - GRAVITY_UP * JUMP_MIN_TICKS * DT;

/** Move value toward target by at most delta. */
export function approach(value: number, target: number, delta: number): number {
  if (value < target) return Math.min(value + delta, target);
  return Math.max(value - delta, target);
}

/** Apply falling gravity with terminal velocity (px/s). */
export function fall(vy: number): number {
  return Math.min(vy + GRAVITY_DOWN * DT, TERMINAL_VELOCITY);
}

/** Ground/air acceleration, deceleration, skid and walk/run top speed. Updates vx and facing. */
export function applyHorizontal(p: Player, held: Buttons): void {
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (dir === 0) {
    p.vx = approach(p.vx, 0, (p.onGround ? GROUND_DECEL : AIR_DECEL) * DT);
    return;
  }
  p.facing = dir > 0 ? 1 : -1;
  const max = held.b ? RUN_SPEED : WALK_SPEED;
  const speed = p.vx * dir;
  let accel: number;
  if (speed < 0) accel = p.onGround ? TURN_DECEL : AIR_ACCEL;
  else if (speed > max) accel = p.onGround ? GROUND_DECEL : AIR_DECEL;
  else accel = p.onGround ? GROUND_ACCEL : AIR_ACCEL;
  p.vx = approach(p.vx, dir * max, accel * DT);
}

/** Start the buffered jump when allowed (on ground or within coyote time). Returns true if it fired. */
export function tryJump(p: Player): boolean {
  if (p.jumpBuffer <= 0 || (!p.onGround && p.coyote <= 0)) return false;
  p.vy = -JUMP_VELOCITY;
  p.jumping = true;
  p.onGround = false;
  p.coyote = 0;
  p.jumpBuffer = 0;
  return true;
}

/**
 * Vertical velocity for one tick: GRAVITY_UP while a jump rises with A held (or during its first
 * JUMP_MIN_TICKS), GRAVITY_DOWN otherwise; releasing A mid-rise multiplies vy by JUMP_CUT.
 */
export function applyVertical(p: Player, held: Buttons): void {
  if (p.jumping) {
    if (p.vy >= 0) p.jumping = false;
    else if (!held.a && -p.vy <= CUT_SPEED) {
      p.jumping = false;
      p.vy *= JUMP_CUT;
    }
  }
  const g = p.jumping ? GRAVITY_UP : GRAVITY_DOWN;
  p.vy = Math.min(p.vy + g * DT, TERMINAL_VELOCITY);
}

/** Refresh coyote time from the post-move ground state. */
export function updateCoyote(p: Player): void {
  p.coyote = p.onGround ? COYOTE_TICKS : Math.max(0, p.coyote - 1);
}

/** Arm the jump buffer on a fresh A press. */
export function bufferJump(p: Player): void {
  p.jumpBuffer = JUMP_BUFFER_TICKS;
}
