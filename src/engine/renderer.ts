import { bumpOffset } from '../game/blocks';
import { tileAt, type TileGrid } from '../game/collision';
import { BEACON_POLE_TILES, SCREEN_W, TILE } from '../game/constants';
import {
  Tile,
  type Enemy,
  type Item,
  type Particle,
  type SpriteId,
  type World,
} from '../game/types';
import { darken, drawSprite, drawText, fill, plot, type Remap } from './draw';
import { drawOverlay, drawHud, phase } from './overlays';
import { getSprite } from './sprites';

/** Cave tiles are drawn one shade lighter so they read against the dark backdrop. */
const CAVE_TILES: Remap = [1, 2, 3, 3];

function decorRow(
  fb: Uint8Array,
  id: SpriteId,
  scroll: number,
  period: number,
  offset: number,
  y: number,
): void {
  const s = getSprite(id);
  const start = Math.floor((scroll - offset) / period) - 1;
  for (let i = start; i * period + offset - scroll < SCREEN_W; i++) {
    drawSprite(fb, s, i * period + offset - scroll, y);
  }
}

/** Bushes sit on top of ground surfaces every few columns (scrolls with the tiles). */
function drawBushes(fb: Uint8Array, grid: TileGrid, cam: number): void {
  const bush = getSprite('bush');
  const tx0 = Math.floor(cam / TILE);
  for (let tx = tx0; tx <= tx0 + SCREEN_W / TILE; tx++) {
    if (tx % 7 !== 3) continue;
    for (let ty = 1; ty < grid.height; ty++) {
      if (tileAt(grid, tx, ty) === Tile.Ground && tileAt(grid, tx, ty - 1) === Tile.Empty) {
        drawSprite(fb, bush, tx * TILE + TILE / 2 - bush.w / 2 - cam, ty * TILE - bush.h);
        break;
      }
    }
  }
}

function drawBackground(fb: Uint8Array, world: World, grid: TileGrid, cam: number): void {
  switch (world.level.def.theme) {
    case 'grass': {
      fill(fb, 3);
      const hill = getSprite('hill');
      decorRow(fb, 'hill', Math.floor(cam / 4), 192, 24, 7 * TILE - hill.h);
      decorRow(fb, 'cloud', Math.floor(cam / 2), 112, 8, 24);
      decorRow(fb, 'cloud', Math.floor(cam / 2), 112, 64, 40);
      drawBushes(fb, grid, cam);
      break;
    }
    case 'cave':
      fill(fb, 0);
      decorRow(fb, 'stalactite', Math.floor(cam / 2), 56, 12, 16);
      decorRow(fb, 'stalactite', Math.floor(cam / 2), 88, 40, 16);
      break;
    case 'sky':
      fill(fb, 3);
      decorRow(fb, 'cloud', Math.floor(cam / 4), 96, 16, 28);
      decorRow(fb, 'cloud', Math.floor(cam / 2), 128, 80, 56);
      decorRow(fb, 'cloud', Math.floor((cam * 3) / 4), 80, 40, 104);
      break;
  }
}

function tileSprite(
  world: World,
  grid: TileGrid,
  tx: number,
  ty: number,
  id: number,
): SpriteId | null {
  switch (id) {
    case Tile.Ground:
      return tileAt(grid, tx, ty - 1) === Tile.Ground ? 'tile_ground' : 'tile_ground_top';
    case Tile.Brick:
      return 'tile_brick';
    case Tile.CoinBlock:
    case Tile.SeedBlock:
      return 'tile_block';
    case Tile.UsedBlock:
      return 'tile_used';
    case Tile.OneWay:
      return 'tile_oneway';
    case Tile.Spike:
      return 'tile_spike';
    case Tile.Hard:
      return 'tile_hard';
    case Tile.Glimmer:
      return (['glimmer_1', 'glimmer_2', 'glimmer_3'] as const)[phase(world, 10, 3)]!;
    default:
      return null;
  }
}

function drawTiles(fb: Uint8Array, world: World, grid: TileGrid, cam: number): void {
  const remap = world.level.def.theme === 'cave' ? CAVE_TILES : undefined;
  const tx0 = Math.floor(cam / TILE);
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = tx0; tx <= tx0 + SCREEN_W / TILE && tx < grid.width; tx++) {
      const id = tileSprite(world, grid, tx, ty, tileAt(grid, tx, ty));
      if (!id) continue;
      const s = getSprite(id);
      drawSprite(fb, s, tx * TILE - cam, ty * TILE + bumpOffset(world, tx, ty), { remap });
    }
  }
}

function drawBeacon(fb: Uint8Array, world: World, cam: number): void {
  const { tx, ty } = world.level.beacon;
  const pole = getSprite('beacon_pole');
  const top = getSprite('beacon_top');
  const flag = getSprite('beacon_flag');
  const topRow = ty - BEACON_POLE_TILES + 1;
  const poleX = tx * TILE + TILE / 2 - Math.floor(pole.w / 2) - cam;
  for (let r = topRow; r <= ty; r++) {
    for (let y = 0; y < TILE; y += Math.max(1, pole.h)) drawSprite(fb, pole, poleX, r * TILE + y);
  }
  drawSprite(fb, top, tx * TILE + TILE / 2 - Math.floor(top.w / 2) - cam, topRow * TILE - top.h);
  const flagY = world.scene === 'clear' ? world.player.y : topRow * TILE + 2;
  drawSprite(fb, flag, poleX - flag.w, Math.round(flagY));
}

/** Draw a sprite anchored to the bottom-centre of a hitbox. */
function drawOnBox(
  fb: Uint8Array,
  id: SpriteId,
  b: { x: number; y: number; w: number; h: number },
  cam: number,
  flipX = false,
  flipY = false,
): void {
  const s = getSprite(id);
  drawSprite(fb, s, Math.round(b.x + b.w / 2 - s.w / 2) - cam, Math.round(b.y + b.h - s.h), {
    flipX,
    flipY,
  });
}

function itemSprite(world: World, it: Item): SpriteId {
  if (it.kind === 'sunseed') return 'sunseed';
  return (['glimmer_1', 'glimmer_2', 'glimmer_3'] as const)[phase(world, 4, 3)]!;
}

function enemySprite(world: World, e: Enemy): SpriteId {
  const f = phase(world, 12, 2);
  switch (e.kind) {
    case 'mossbug':
      if (e.state === 'squashed') return 'mossbug_squashed';
      return f === 0 ? 'mossbug_walk1' : 'mossbug_walk2';
    case 'snapper':
      return f === 0 ? 'snapper_walk1' : 'snapper_walk2';
    case 'flutter':
      return phase(world, 8, 2) === 0 ? 'flutter_1' : 'flutter_2';
  }
}

function playerSprite(world: World): SpriteId {
  const p = world.player;
  if (p.anim === 'dead') return 'pip_dead';
  const prefix = p.form === 'bloom' ? 'bloom' : 'pip';
  switch (p.anim) {
    case 'run':
      return phase(world, 6, 2) === 0 ? `${prefix}_run1` : `${prefix}_run2`;
    case 'jump':
      return `${prefix}_jump`;
    case 'fall':
      return `${prefix}_fall`;
    default:
      return `${prefix}_idle`;
  }
}

function drawParticle(fb: Uint8Array, pt: Particle, cam: number): void {
  const x = Math.round(pt.x) - cam;
  const y = Math.round(pt.y);
  if (pt.kind === 'shard') drawSprite(fb, getSprite('shard'), x, y);
  else if (pt.kind === 'score') drawText(fb, String(pt.value), x, y, 0);
  else
    for (const [dx, dy] of [
      [0, -2],
      [0, 2],
      [-2, 0],
      [2, 0],
      [0, 0],
    ] as const)
      plot(fb, x + dx, y + dy, 0);
}

/** The scrolling playfield: background, tiles, Beacon, items, enemies, Pip, particles. */
export function drawPlayfield(fb: Uint8Array, world: World): void {
  const cam = Math.round(world.camera.x);
  const grid: TileGrid = {
    tiles: world.tiles,
    width: world.level.width,
    height: world.level.height,
  };
  drawBackground(fb, world, grid, cam);
  for (const it of world.items) {
    if (it.kind === 'sunseed' && it.state === 'emerging') drawOnBox(fb, 'sunseed', it, cam);
  }
  drawTiles(fb, world, grid, cam);
  drawBeacon(fb, world, cam);
  for (const it of world.items) {
    if (it.kind !== 'sunseed' || it.state !== 'emerging')
      drawOnBox(fb, itemSprite(world, it), it, cam);
  }
  for (const e of world.enemies) {
    if (e.active) drawOnBox(fb, enemySprite(world, e), e, cam, e.dir < 0, e.state === 'dead');
  }
  const p = world.player;
  const blinkHidden = p.invuln > 0 && !world.freezeAnim && Math.floor(world.tick / 4) % 2 === 1;
  if (!blinkHidden) drawOnBox(fb, playerSprite(world), p, cam, p.facing < 0);
  for (const pt of world.particles) drawParticle(fb, pt, cam);
}

/**
 * Rasterize the world into a 160x144 framebuffer of shade indices 0..3. Pure: depends only on
 * `world` (and the static sprite/font data); animation phases come from world.tick unless
 * world.freezeAnim.
 */
export function rasterize(world: World, fb: Uint8Array): void {
  switch (world.scene) {
    case 'boot':
    case 'intro':
    case 'gameover':
    case 'win':
      drawOverlay(fb, world);
      return;
    case 'title':
      drawPlayfield(fb, world);
      drawOverlay(fb, world);
      return;
    case 'paused':
      drawPlayfield(fb, world);
      drawHud(fb, world);
      darken(fb);
      drawOverlay(fb, world);
      return;
    default:
      drawPlayfield(fb, world);
      drawHud(fb, world);
      drawOverlay(fb, world);
  }
}
