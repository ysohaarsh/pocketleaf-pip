import { nextRandom } from '../engine/prng';
import { gridOf, moveBox, overlaps } from './collision';
import {
  DT,
  GLIMMERS_PER_LIFE,
  GRAVITY_DOWN,
  MAX_LIVES,
  MAX_SCORE,
  POP_GLIMMER_TICKS,
  POP_GLIMMER_VELOCITY,
  SCORE_FLOAT_TICKS,
  SCORE_FLOAT_VY,
  SCORE_GLIMMER,
  SCORE_POPUP_TICKS,
  SCORE_SEED,
  SEED_EMERGE_TICKS,
  SEED_SIZE,
  SEED_SPEED,
  SHARD_TICKS,
  SHARD_VX,
  SHARD_VY,
  TILE,
} from './constants';
import { emitSfx } from './events';
import { fall } from './physics';
import type { Particle, World } from './types';

/** Add points (capped) and float the value above (x, y). */
export function addScore(world: World, points: number, x: number, y: number): void {
  world.score = Math.min(MAX_SCORE, world.score + points);
  floatScore(world, points, x, y);
}

/** Show floating score text at (x, y) without changing the score. */
export function floatScore(world: World, points: number, x: number, y: number): void {
  world.particles.push({
    kind: 'score',
    x,
    y,
    vx: 0,
    vy: -SCORE_FLOAT_VY,
    timer: SCORE_FLOAT_TICKS,
    value: points,
  });
}

/** Count one Glimmer: score, coin counter, extra life every GLIMMERS_PER_LIFE. */
export function collectGlimmer(world: World): void {
  world.score = Math.min(MAX_SCORE, world.score + SCORE_GLIMMER);
  world.coins += 1;
  emitSfx(world, 'coin');
  if (world.coins >= GLIMMERS_PER_LIFE) {
    world.coins = 0;
    world.lives = Math.min(MAX_LIVES, world.lives + 1);
    emitSfx(world, 'oneup');
  }
}

/** A Sun Seed starts emerging out of block (tx, ty). */
export function spawnSeed(world: World, tx: number, ty: number): void {
  world.items.push({
    id: world.nextId++,
    kind: 'sunseed',
    x: tx * TILE + (TILE - SEED_SIZE) / 2,
    y: ty * TILE + (TILE - SEED_SIZE),
    w: SEED_SIZE,
    h: SEED_SIZE,
    vx: 0,
    vy: 0,
    state: 'emerging',
    timer: 0,
  });
}

/** A Glimmer pops up out of block (tx, ty) (already counted by the caller). */
export function spawnPopGlimmer(world: World, tx: number, ty: number): void {
  world.items.push({
    id: world.nextId++,
    kind: 'popGlimmer',
    x: tx * TILE + 4,
    y: ty * TILE - TILE,
    w: 8,
    h: 14,
    vx: 0,
    vy: -POP_GLIMMER_VELOCITY,
    state: 'emerging',
    timer: 0,
  });
}

/** A seeded random number in [0, 1) that advances world.rng. */
export function random(world: World): number {
  const [value, next] = nextRandom(world.rng);
  world.rng = next;
  return value;
}

/** Four brick shards fly out of tile (tx, ty) with a little seeded jitter. */
export function spawnShards(world: World, tx: number, ty: number): void {
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
  ] as const) {
    world.particles.push({
      kind: 'shard',
      x: cx + sx * 4,
      y: cy + sy * 4,
      vx: sx * SHARD_VX * (0.8 + 0.4 * random(world)),
      vy: sy < 0 ? -SHARD_VY : -SHARD_VY * 0.66,
      timer: SHARD_TICKS,
      value: 0,
    });
  }
}

function collectSeed(world: World, x: number, y: number): void {
  const p = world.player;
  if (p.form === 'small') p.form = 'bloom';
  emitSfx(world, 'powerup');
  addScore(world, SCORE_SEED, x, y);
}

/** Simulate Sun Seeds and popped Glimmers; Pip collects Seeds on overlap. */
export function updateItems(world: World): void {
  world.items = world.items.filter((it) => it.state !== 'done');
  const grid = gridOf(world);
  const limit = world.level.height * TILE;
  for (const it of world.items) {
    it.timer++;
    if (it.kind === 'popGlimmer') {
      it.vy += GRAVITY_DOWN * DT;
      it.y += it.vy * DT;
      if (it.timer >= POP_GLIMMER_TICKS) {
        it.state = 'done';
        world.particles.push({
          kind: 'sparkle',
          x: it.x,
          y: it.y,
          vx: 0,
          vy: 0,
          timer: SCORE_POPUP_TICKS,
          value: 0,
        });
        floatScore(world, SCORE_GLIMMER, it.x, it.y);
      }
      continue;
    }
    if (it.state === 'emerging') {
      it.y -= 1;
      if (it.timer >= SEED_EMERGE_TICKS) {
        it.state = 'moving';
        it.vx = SEED_SPEED;
      }
    } else {
      it.vy = fall(it.vy);
      const prevVx = it.vx;
      const res = moveBox(grid, it, it.vx * DT, it.vy * DT);
      if (res.hitX) it.vx = -prevVx;
      if (res.landed || res.hitTop) it.vy = 0;
      if (it.y > limit) it.state = 'done';
    }
    if (it.state !== 'done' && !world.player.dead && overlaps(it, world.player)) {
      it.state = 'done';
      collectSeed(world, it.x, it.y);
    }
  }
}

/** Advance particles; shards fall, score text floats; expired ones are removed. */
export function updateParticles(world: World): void {
  const keep: Particle[] = [];
  for (const pt of world.particles) {
    pt.timer--;
    if (pt.timer <= 0) continue;
    if (pt.kind === 'shard') pt.vy += GRAVITY_DOWN * DT;
    pt.x += pt.vx * DT;
    pt.y += pt.vy * DT;
    keep.push(pt);
  }
  world.particles = keep;
}
