import { hitBlock } from './blocks';
import { forEachOverlappedTile, gridOf, moveBox } from './collision';
import {
  DT,
  HURT_INVULN_TICKS,
  RUN_ANIM_MIN_SPEED,
  SPIKE_HEIGHT,
  SPIKE_INSET,
  TILE,
} from './constants';
import { emitSfx } from './events';
import { collectGlimmer } from './items';
import { applyHorizontal, applyVertical, bufferJump, tryJump, updateCoyote } from './physics';
import { enterDying } from './scenes/transitions';
import { Tile, type InputFrame, type Player, type PlayerAnim, type World } from './types';

/** Pip takes a hit: Bloom shrinks with i-frames, small Pip dies. Ignored while invulnerable. */
export function damagePlayer(world: World): void {
  const p = world.player;
  if (p.dead || p.invuln > 0) return;
  if (p.form === 'bloom') {
    p.form = 'small';
    p.invuln = HURT_INVULN_TICKS;
    emitSfx(world, 'hurt');
  } else {
    enterDying(world);
  }
}

function pickAnim(p: Player): PlayerAnim {
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
  return Math.abs(p.vx) > RUN_ANIM_MIN_SPEED ? 'run' : 'idle';
}

/** Glimmers are collected on overlap; the lower SPIKE_HEIGHT px of a spike tile kill. */
function touchTiles(world: World): void {
  const p = world.player;
  const grid = gridOf(world);
  let spiked = false;
  forEachOverlappedTile(grid, p, (tx, ty, id) => {
    if (id === Tile.Glimmer) {
      grid.tiles[ty * grid.width + tx] = Tile.Empty;
      collectGlimmer(world);
    } else if (id === Tile.Spike) {
      const top = (ty + 1) * TILE - SPIKE_HEIGHT;
      if (
        p.y + p.h > top &&
        p.x + p.w > tx * TILE + SPIKE_INSET &&
        p.x < (tx + 1) * TILE - SPIKE_INSET
      )
        spiked = true;
    }
  });
  if (spiked) enterDying(world);
}

/**
 * One tick of Pip in the playing scene: input → velocity → tile collision → block hits,
 * Glimmers, hazards, pit, animation state.
 */
export function updatePlayer(world: World, input: InputFrame): void {
  const p = world.player;
  const { held, pressed } = input;
  if (p.invuln > 0) p.invuln--;

  applyHorizontal(p, held);
  if (pressed.a) bufferJump(p);
  if (tryJump(p)) emitSfx(world, 'jump');
  applyVertical(p, held);

  const res = moveBox(gridOf(world), p, p.vx * DT, p.vy * DT);
  if (res.hitX) p.vx = 0;
  p.onGround = res.landed;
  if (res.landed) p.vy = 0;
  if (res.hitTop) {
    p.vy = 0;
    p.jumping = false;
    hitBlock(world, res.hitTop.tx, res.hitTop.ty);
  }
  updateCoyote(p);
  if (p.onGround && tryJump(p)) emitSfx(world, 'jump');
  if (!pressed.a && p.jumpBuffer > 0) p.jumpBuffer--;

  touchTiles(world);
  if (!p.dead && p.y > world.level.height * TILE) enterDying(world);
  if (p.dead) return;

  const anim = pickAnim(p);
  if (anim !== p.anim) {
    p.anim = anim;
    p.animTick = 0;
  } else p.animTick++;
}
