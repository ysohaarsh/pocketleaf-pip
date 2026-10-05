import { BOOT_CHIME_TICK, BOOT_TICKS } from '../constants';
import { emitSfx } from '../events';
import { BUTTON_NAMES, type InputFrame, type World } from '../types';
import { enterTitle } from './transitions';

/** Power-on: fade in, wordmark slides down, chime; any pressed button skips to the title. */
export function updateBoot(world: World, input: InputFrame): void {
  if (BUTTON_NAMES.some((b) => input.pressed[b]) || world.sceneTick >= BOOT_TICKS) {
    enterTitle(world);
    return;
  }
  if (world.sceneTick === BOOT_CHIME_TICK) emitSfx(world, 'boot');
}
