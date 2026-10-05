import { TILE } from './constants';
import { Tile, type TileId, type World } from './types';

/** An axis-aligned box in world pixels (top-left + size). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The tile grid a body collides against. */
export interface TileGrid {
  tiles: Uint8Array;
  width: number;
  height: number;
}

export interface TileRef {
  tx: number;
  ty: number;
}

export interface MoveResult {
  /** Blocked horizontally. */
  hitX: boolean;
  /** Came to rest on top of a solid or one-way tile. */
  landed: boolean;
  /** Tile hit from below while moving up (the one closest to the box's centre x), or null. */
  hitTop: TileRef | null;
}

/** Longest distance moved in one collision sub-step (px). Smaller than any box or tile → no tunnelling. */
const MAX_SUBSTEP = 8;
/** Edge epsilon so a box flush against a tile boundary does not count as overlapping it. */
const EPS = 1e-6;

const SOLID: ReadonlySet<number> = new Set<number>([
  Tile.Ground,
  Tile.Hard,
  Tile.Brick,
  Tile.CoinBlock,
  Tile.SeedBlock,
  Tile.UsedBlock,
]);

/** True for tiles that block from every side. */
export function isSolidTile(id: number): boolean {
  return SOLID.has(id);
}

/** True for tiles a body can stand on (solids and one-way platforms). */
export function isStandable(id: number): boolean {
  return isSolidTile(id) || id === Tile.OneWay;
}

/** The live tile grid of the current attempt. */
export function gridOf(world: World): TileGrid {
  return { tiles: world.tiles, width: world.level.width, height: world.level.height };
}

/**
 * Tile at a grid position. Columns outside the level are solid walls; rows above or below the
 * map are empty (so bodies can jump above the top and fall out of the bottom).
 */
export function tileAt(grid: TileGrid, tx: number, ty: number): TileId {
  if (tx < 0 || tx >= grid.width) return Tile.Hard;
  if (ty < 0 || ty >= grid.height) return Tile.Empty;
  return grid.tiles[ty * grid.width + tx] as TileId;
}

/** Overwrite one in-bounds tile (out-of-bounds writes are ignored). */
export function setTile(grid: TileGrid, tx: number, ty: number, id: TileId): void {
  if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) return;
  grid.tiles[ty * grid.width + tx] = id;
}

/** True when two boxes overlap (touching edges do not count). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Inclusive tile range covered by [start, start + size). */
function span(start: number, size: number): [number, number] {
  return [Math.floor(start / TILE), Math.floor((start + size - EPS) / TILE)];
}

function moveX(grid: TileGrid, box: Box, dx: number): boolean {
  const [ty0, ty1] = span(box.y, box.h);
  const nx = box.x + dx;
  const tx = dx > 0 ? Math.floor((nx + box.w - EPS) / TILE) : Math.floor(nx / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (!isSolidTile(tileAt(grid, tx, ty))) continue;
    box.x = dx > 0 ? tx * TILE - box.w : (tx + 1) * TILE;
    return true;
  }
  box.x = nx;
  return false;
}

/** Of the solid tiles in row ty under the box's span, the one closest to the box's centre x. */
function pickHeadTile(grid: TileGrid, box: Box, ty: number): TileRef | null {
  const [tx0, tx1] = span(box.x, box.w);
  const cx = box.x + box.w / 2;
  let best: TileRef | null = null;
  let bestDist = Infinity;
  for (let tx = tx0; tx <= tx1; tx++) {
    if (!isSolidTile(tileAt(grid, tx, ty))) continue;
    const dist = Math.abs(tx * TILE + TILE / 2 - cx);
    if (dist < bestDist) {
      bestDist = dist;
      best = { tx, ty };
    }
  }
  return best;
}

function moveY(grid: TileGrid, box: Box, dy: number, oneWay: boolean, result: MoveResult): boolean {
  const ny = box.y + dy;
  if (dy > 0) {
    const [tx0, tx1] = span(box.x, box.w);
    const prevBottom = box.y + box.h;
    const ty = Math.floor((ny + box.h - EPS) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = tileAt(grid, tx, ty);
      const platform = oneWay && id === Tile.OneWay && prevBottom <= ty * TILE + EPS;
      if (!isSolidTile(id) && !platform) continue;
      box.y = ty * TILE - box.h;
      result.landed = true;
      return true;
    }
  } else {
    const ty = Math.floor(ny / TILE);
    const head = pickHeadTile(grid, box, ty);
    if (head) {
      box.y = (ty + 1) * TILE;
      result.hitTop = head;
      return true;
    }
  }
  box.y = ny;
  return false;
}

function substeps(total: number, fn: (d: number) => boolean): boolean {
  let rest = total;
  while (rest !== 0) {
    const d = Math.abs(rest) > MAX_SUBSTEP ? Math.sign(rest) * MAX_SUBSTEP : rest;
    rest -= d;
    if (fn(d)) return true;
  }
  return false;
}

/**
 * Move a box by (dx, dy) through the tile grid: X is resolved first, then Y, each in sub-steps of
 * at most MAX_SUBSTEP px so nothing tunnels. One-way platforms (when `oneWay`) block only a box
 * falling onto them whose bottom was at/above the platform top before the step. Mutates box.x/y.
 */
export function moveBox(
  grid: TileGrid,
  box: Box,
  dx: number,
  dy: number,
  oneWay = true,
): MoveResult {
  const result: MoveResult = { hitX: false, landed: false, hitTop: null };
  result.hitX = substeps(dx, (d) => moveX(grid, box, d));
  substeps(dy, (d) => moveY(grid, box, d, oneWay, result));
  return result;
}

/** Calls fn for each in-bounds tile overlapped by the box. */
export function forEachOverlappedTile(
  grid: TileGrid,
  box: Box,
  fn: (tx: number, ty: number, id: TileId) => void,
): void {
  const [tx0, tx1] = span(box.x, box.w);
  const [ty0, ty1] = span(box.y, box.h);
  for (let ty = Math.max(0, ty0); ty <= Math.min(grid.height - 1, ty1); ty++) {
    for (let tx = Math.max(0, tx0); tx <= Math.min(grid.width - 1, tx1); tx++) {
      fn(tx, ty, tileAt(grid, tx, ty));
    }
  }
}
