import { START_LIVES } from '../constants';
import { emitSfx } from '../events';
import type { InputFrame, World } from '../types';
import { enterIntro, enterTitle, loadLevel } from './transitions';

/** Game over menu: CONTINUE (retry this level with fresh lives, score 0) or TITLE. */
export function updateGameOver(world: World, input: InputFrame): void {
  if (input.pressed.up || input.pressed.down) {
    world.menuIndex = world.menuIndex === 0 ? 1 : 0;
    emitSfx(world, 'select');
    return;
  }
  if (!input.pressed.start && !input.pressed.a) return;
  if (world.menuIndex === 0) {
    world.lives = START_LIVES;
    world.score = 0;
    world.coins = 0;
    loadLevel(world, world.levelIndex, 'small');
    enterIntro(world);
  } else {
    enterTitle(world);
  }
}
