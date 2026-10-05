import { updateBumps } from '../blocks';
import { updateCamera } from '../camera';
import { overlaps } from '../collision';
import { BEACON_POLE_TILES, TILE } from '../constants';
import { updateEnemies } from '../enemies';
import { updateItems, updateParticles } from '../items';
import { updatePlayer } from '../player';
import type { InputFrame, World } from '../types';
import { enterClear, enterDying, enterPaused } from './transitions';

/** True when Pip touches the Beacon pole column. */
export function touchesBeacon(world: World): boolean {
  const { tx, ty } = world.level.beacon;
  const top = (ty - BEACON_POLE_TILES + 1) * TILE;
  const pole = { x: tx * TILE + 6, y: top, w: 4, h: (ty + 1) * TILE - top };
  return overlaps(world.player, pole);
}

/** Gameplay tick: timer, Pip, items, enemies, effects, camera, Beacon. */
export function updatePlaying(world: World, input: InputFrame): void {
  if (input.pressed.start) {
    enterPaused(world);
    return;
  }
  world.timeTicks = Math.max(0, world.timeTicks - 1);
  if (world.timeTicks === 0) {
    enterDying(world);
    return;
  }
  const prevBottom = world.player.y + world.player.h;
  updatePlayer(world, input);
  updateItems(world);
  updateEnemies(world, prevBottom, input.held.a);
  updateBumps(world);
  updateParticles(world);
  updateCamera(world);
  if (world.scene === 'playing' && touchesBeacon(world)) enterClear(world);
}
