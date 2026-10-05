import {
  CLEAR_SLIDE_SPEED,
  CLEAR_TICKS,
  MAX_SCORE,
  SCORE_TIME_BONUS,
  TALLY_SECONDS_PER_TICK,
  TICK_RATE,
  TILE,
} from '../constants';
import { checkHighScore } from '../events';
import { updateParticles } from '../items';
import type { World } from '../types';
import { enterIntro, enterWin, loadLevel } from './transitions';

/** Convert up to `seconds` of remaining time into score. Returns true while time remains. */
function tally(world: World, seconds: number): boolean {
  const left = Math.ceil(world.timeTicks / TICK_RATE);
  const take = Math.min(left, seconds);
  world.timeTicks = (left - take) * TICK_RATE;
  world.score = Math.min(MAX_SCORE, world.score + take * SCORE_TIME_BONUS);
  return left - take > 0;
}

/** Pip slides down the pole, remaining time tallies into score, then the next level (or win). */
export function updateClear(world: World): void {
  const p = world.player;
  const ground = (world.level.beacon.ty + 1) * TILE;
  updateParticles(world);
  if (p.y + p.h < ground) {
    p.y = Math.min(ground - p.h, p.y + CLEAR_SLIDE_SPEED);
    return;
  }
  const pending = tally(world, TALLY_SECONDS_PER_TICK);
  if (pending || world.sceneTick < CLEAR_TICKS) return;
  checkHighScore(world);
  const next = world.levelIndex + 1;
  if (next < world.levels.length) {
    loadLevel(world, next, p.form);
    enterIntro(world);
  } else {
    enterWin(world);
  }
}
