import { CAMERA_DEADZONE, CAMERA_LOOKAHEAD, CAMERA_MAX_STEP, SCREEN_W, TILE } from './constants';
import type { World } from './types';

function clampX(world: World, x: number): number {
  const max = Math.max(0, world.level.width * TILE - SCREEN_W);
  return Math.min(max, Math.max(0, Math.round(x)));
}

/** Where the camera wants to be: Pip (plus look-ahead) kept inside the deadzone. */
export function cameraTarget(world: World): number {
  const p = world.player;
  const focus = p.x + p.w / 2 + p.facing * CAMERA_LOOKAHEAD;
  const centre = world.camera.x + SCREEN_W / 2;
  let x = world.camera.x;
  if (focus > centre + CAMERA_DEADZONE) x = focus - SCREEN_W / 2 - CAMERA_DEADZONE;
  else if (focus < centre - CAMERA_DEADZONE) x = focus - SCREEN_W / 2 + CAMERA_DEADZONE;
  return clampX(world, x);
}

/** Follow Pip horizontally (integer px, at most CAMERA_MAX_STEP per tick, backtracking allowed). */
export function updateCamera(world: World): void {
  const target = cameraTarget(world);
  const dx = Math.max(-CAMERA_MAX_STEP, Math.min(CAMERA_MAX_STEP, target - world.camera.x));
  world.camera.x = clampX(world, world.camera.x + dx);
  world.camera.y = 0;
}

/** Jump the camera straight to Pip (level start). */
export function snapCamera(world: World): void {
  const p = world.player;
  world.camera.x = clampX(world, p.x + p.w / 2 + p.facing * CAMERA_LOOKAHEAD - SCREEN_W / 2);
  world.camera.y = 0;
}
