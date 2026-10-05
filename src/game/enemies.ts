import { gridOf, isStandable, moveBox, overlaps, tileAt, type TileGrid } from './collision';
import {
  ACTIVATE_MARGIN,
  DT,
  FLUTTER_AMPLITUDE,
  FLUTTER_PERIOD,
  FLUTTER_SPEED,
  FLUTTER_TURN_TICKS,
  MOSSBUG_SPEED,
  SCORE_STOMP,
  SCREEN_W,
  SNAPPER_SPEED,
  SQUASH_TICKS,
  STOMP_BOUNCE,
  STOMP_BOUNCE_HELD,
  TILE,
} from './constants';
import { emitSfx } from './events';
import { addScore } from './items';
import { fall } from './physics';
import { damagePlayer } from './player';
import type { Enemy, World } from './types';

/** True when the enemy is within ACTIVATE_MARGIN of the camera view. */
function nearView(world: World, e: Enemy): boolean {
  const left = world.camera.x - ACTIVATE_MARGIN;
  const right = world.camera.x + SCREEN_W + ACTIVATE_MARGIN;
  return e.x + e.w > left && e.x < right;
}

/** True when the ground ahead of a walker's leading foot is missing. */
function ledgeAhead(grid: TileGrid, e: Enemy, step: number): boolean {
  const probeX = e.dir > 0 ? e.x + e.w + step : e.x - step;
  const below = Math.floor((e.y + e.h + 1) / TILE);
  return !isStandable(tileAt(grid, Math.floor(probeX / TILE), below));
}

function walk(grid: TileGrid, e: Enemy, speed: number): void {
  const step = speed * DT;
  if (e.onGround && ledgeAhead(grid, e, step)) e.dir = e.dir > 0 ? -1 : 1;
  e.vx = e.dir * speed;
  e.vy = fall(e.vy);
  const res = moveBox(grid, e, e.vx * DT, e.vy * DT);
  if (res.hitX) e.dir = e.dir > 0 ? -1 : 1;
  e.onGround = res.landed;
  if (res.landed || res.hitTop) e.vy = 0;
}

function flutter(grid: TileGrid, e: Enemy): void {
  e.timer++;
  if (e.timer % FLUTTER_TURN_TICKS === 0) e.dir = e.dir > 0 ? -1 : 1;
  e.vx = e.dir * FLUTTER_SPEED;
  const res = moveBox(grid, e, e.vx * DT, 0);
  if (res.hitX) e.dir = e.dir > 0 ? -1 : 1;
  e.y = e.baseY + Math.sin((2 * Math.PI * e.timer) / FLUTTER_PERIOD) * FLUTTER_AMPLITUDE;
}

/** Stomp (falling onto a stompable enemy from above) or take damage. */
function touchPlayer(
  world: World,
  e: Enemy,
  prevBottom: number,
  prevTop: number,
  aHeld: boolean,
  falling: boolean,
): void {
  const p = world.player;
  if (p.dead || !overlaps(p, e)) return;
  // `falling` is sampled before any contact this tick, so stomping two overlapping enemies at
  // once counts both as stomps instead of the second seeing the first bounce's upward velocity.
  const fromAbove = falling && prevBottom <= prevTop;
  if (e.kind !== 'snapper' && fromAbove) {
    if (e.kind === 'flutter') {
      e.state = 'dead';
      e.vy = 0;
    } else {
      e.state = 'squashed';
      e.timer = SQUASH_TICKS;
    }
    e.vx = 0;
    p.y = e.y - p.h;
    p.vy = aHeld ? -STOMP_BOUNCE_HELD : -STOMP_BOUNCE;
    p.jumping = aHeld;
    addScore(world, SCORE_STOMP, e.x, e.y);
    emitSfx(world, 'stomp');
    return;
  }
  damagePlayer(world);
}

/**
 * Activate, move and resolve player contact for every enemy. `prevPlayerBottom` is Pip's bottom
 * edge before this tick's movement (for the stomp test). Squashed/dead/fallen enemies are removed.
 */
export function updateEnemies(world: World, prevPlayerBottom: number, aHeld: boolean): void {
  const grid = gridOf(world);
  const limit = world.level.height * TILE;
  const falling = world.player.vy > 0;
  for (const e of world.enemies) {
    if (!e.active) {
      if (!nearView(world, e)) continue;
      e.active = true;
    }
    if (e.state === 'squashed') {
      e.timer--;
      continue;
    }
    if (e.state === 'dead') {
      e.vy = fall(e.vy);
      e.x += e.vx * DT;
      e.y += e.vy * DT;
      continue;
    }
    const prevTop = e.y;
    if (e.kind === 'flutter') flutter(grid, e);
    else walk(grid, e, e.kind === 'snapper' ? SNAPPER_SPEED : MOSSBUG_SPEED);
    touchPlayer(world, e, prevPlayerBottom, prevTop, aHeld, falling);
  }
  world.enemies = world.enemies.filter(
    (e) => e.y <= limit && !(e.state === 'squashed' && e.timer <= 0),
  );
}
