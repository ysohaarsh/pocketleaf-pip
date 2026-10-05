import { DEATH_HANG_TICKS, DT, DYING_TICKS } from '../constants';
import { fall } from '../physics';
import type { World } from '../types';
import { enterGameOver, enterIntro, loadLevel } from './transitions';

/** Pip hangs, then falls off screen; then a life is lost (retry or game over). */
export function updateDying(world: World): void {
  const p = world.player;
  if (world.sceneTick >= DEATH_HANG_TICKS) {
    p.vy = fall(p.vy);
    p.y += p.vy * DT;
  }
  if (world.sceneTick < DYING_TICKS) return;
  world.lives -= 1;
  if (world.lives > 0) {
    loadLevel(world, world.levelIndex, 'small');
    enterIntro(world);
  } else {
    enterGameOver(world);
  }
}
