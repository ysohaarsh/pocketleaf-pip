import { gridOf, setTile, tileAt } from './collision';
import { BUMP_HEIGHT, BUMP_TICKS, KNOCK_POP, SCORE_BRICK, SCORE_STOMP, TILE } from './constants';
import { emitSfx } from './events';
import { addScore, collectGlimmer, spawnPopGlimmer, spawnSeed, spawnShards } from './items';
import { Tile, type World } from './types';

/** Things standing on top of a bumped tile get knocked: enemies die, Seeds hop. */
function knockAbove(world: World, tx: number, ty: number): void {
  const top = ty * TILE;
  const left = tx * TILE;
  const onTop = (b: { x: number; y: number; w: number; h: number }): boolean =>
    Math.abs(b.y + b.h - top) <= 2 && b.x < left + TILE && b.x + b.w > left;
  for (const e of world.enemies) {
    if (e.state !== 'walk' || !onTop(e)) continue;
    e.state = 'dead';
    e.vy = -KNOCK_POP;
    e.vx = e.dir * 30;
    addScore(world, SCORE_STOMP, e.x, e.y);
    emitSfx(world, 'stomp');
  }
  for (const it of world.items) {
    if (it.kind === 'sunseed' && it.state === 'moving' && onTop(it)) it.vy = -KNOCK_POP;
  }
  if (tileAt(gridOf(world), tx, ty - 1) === Tile.Glimmer) {
    setTile(gridOf(world), tx, ty - 1, Tile.Empty);
    collectGlimmer(world);
    spawnPopGlimmer(world, tx, ty);
  }
}

function startBump(world: World, tx: number, ty: number): void {
  if (!world.bumps.some((b) => b.tx === tx && b.ty === ty)) {
    world.bumps.push({ tx, ty, timer: BUMP_TICKS });
  }
  knockAbove(world, tx, ty);
}

/** Pip's head hit tile (tx, ty) from below. */
export function hitBlock(world: World, tx: number, ty: number): void {
  const grid = gridOf(world);
  switch (tileAt(grid, tx, ty)) {
    case Tile.CoinBlock:
      setTile(grid, tx, ty, Tile.UsedBlock);
      startBump(world, tx, ty);
      collectGlimmer(world);
      spawnPopGlimmer(world, tx, ty);
      break;
    case Tile.SeedBlock:
      setTile(grid, tx, ty, Tile.UsedBlock);
      startBump(world, tx, ty);
      spawnSeed(world, tx, ty);
      emitSfx(world, 'sprout');
      break;
    case Tile.Brick:
      if (world.player.form === 'bloom') {
        setTile(grid, tx, ty, Tile.Empty);
        knockAbove(world, tx, ty);
        spawnShards(world, tx, ty);
        addScore(world, SCORE_BRICK, tx * TILE, ty * TILE);
        emitSfx(world, 'break');
      } else {
        startBump(world, tx, ty);
        emitSfx(world, 'bump');
      }
      break;
    default:
      emitSfx(world, 'bump');
  }
}

/** Advance bump animations. */
export function updateBumps(world: World): void {
  for (const b of world.bumps) b.timer--;
  world.bumps = world.bumps.filter((b) => b.timer > 0);
}

/** Vertical draw offset (px, negative = up) of a bumping tile; 0 when not bumping. */
export function bumpOffset(world: World, tx: number, ty: number): number {
  const b = world.bumps.find((bb) => bb.tx === tx && bb.ty === ty);
  if (!b) return 0;
  const t = (BUMP_TICKS - b.timer) / BUMP_TICKS;
  return -Math.round(Math.sin(Math.PI * t) * BUMP_HEIGHT);
}
