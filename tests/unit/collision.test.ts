import { describe, expect, it } from 'vitest';
import {
  forEachOverlappedTile,
  isSolidTile,
  isStandable,
  moveBox,
  overlaps,
  setTile,
  tileAt,
  type Box,
  type TileGrid,
} from '../../src/game/collision';
import { DT, TERMINAL_VELOCITY } from '../../src/game/constants';
import { Tile } from '../../src/game/types';

const CH: Record<string, number> = {
  '.': Tile.Empty,
  '#': Tile.Ground,
  '=': Tile.OneWay,
  B: Tile.Brick,
  '?': Tile.CoinBlock,
  X: Tile.Hard,
  o: Tile.Glimmer,
};

function grid(rows: string[]): TileGrid {
  const width = rows[0]!.length;
  const tiles = new Uint8Array(width * rows.length);
  rows.forEach((r, ty) => [...r].forEach((c, tx) => (tiles[ty * width + tx] = CH[c]!)));
  return { tiles, width, height: rows.length };
}

const box = (x: number, y: number, w = 10, h = 14): Box => ({ x, y, w, h });

describe('tile collision', () => {
  const g = grid([
    '........', // 0
    '........', // 1
    '...#....', // 2
    '........', // 3
    '..====..', // 4
    '.......#', // 5
    '#......#', // 6
    '########', // 7
  ]);

  it('classifies solid, standable and out-of-bounds tiles', () => {
    for (const t of [
      Tile.Ground,
      Tile.Hard,
      Tile.Brick,
      Tile.CoinBlock,
      Tile.SeedBlock,
      Tile.UsedBlock,
    ])
      expect(isSolidTile(t)).toBe(true);
    for (const t of [Tile.Empty, Tile.OneWay, Tile.Spike, Tile.Glimmer])
      expect(isSolidTile(t)).toBe(false);
    expect(isStandable(Tile.OneWay)).toBe(true);
    expect(tileAt(g, -1, 3)).toBe(Tile.Hard);
    expect(tileAt(g, 8, 3)).toBe(Tile.Hard);
    expect(tileAt(g, 3, -1)).toBe(Tile.Empty);
    expect(tileAt(g, 3, 99)).toBe(Tile.Empty);
  });

  it('resolves X then Y: a diagonal move into a corner slides along the floor and stops at the wall', () => {
    // Bottom at 95 (row 5), moving right+down into the wall at column 7 and the floor at row 6.
    const b = box(100, 81);
    const r = moveBox(g, b, 20, 20);
    expect(r.hitX).toBe(true);
    expect(b.x).toBe(7 * 16 - 10);
    expect(r.landed).toBe(true);
    expect(b.y).toBe(7 * 16 - 14);
    // Moving left into the left wall.
    const c = box(20, 84);
    expect(moveBox(g, c, -10, 0).hitX).toBe(true);
    expect(c.x).toBe(16);
  });

  it('does not tunnel through a floor at terminal velocity (or far beyond it)', () => {
    for (const speed of [TERMINAL_VELOCITY, TERMINAL_VELOCITY * 5]) {
      const b = box(80, 0);
      let landed = false;
      for (let i = 0; i < 60 && !landed; i++) landed = moveBox(g, b, 0, speed * DT, false).landed;
      expect(landed).toBe(true);
      expect(b.y + b.h).toBe(7 * 16);
    }
    const fast = box(80, 0);
    expect(moveBox(g, fast, 0, 200, false).landed).toBe(true);
    expect(fast.y + fast.h).toBe(7 * 16);
  });

  it('one-way platforms hold only bodies falling from above', () => {
    // Falling from above onto row 4.
    const above = box(40, 64 - 14 - 3);
    expect(moveBox(g, above, 0, 6).landed).toBe(true);
    expect(above.y + above.h).toBe(64);
    // Jumping up through it from below.
    const below = box(40, 70);
    const up = moveBox(g, below, 0, -20);
    expect(up.hitTop).toBeNull();
    expect(below.y).toBe(50);
    // Falling while already overlapping (bottom below the top) passes through.
    const inside = box(40, 64 - 10);
    expect(moveBox(g, inside, 0, 4).landed).toBe(false);
    // Walking sideways through it is never blocked.
    const side = box(10, 60);
    expect(moveBox(g, side, 30, 0).hitX).toBe(false);
    // One-way disabled → ignored entirely.
    const off = box(40, 64 - 14 - 3);
    expect(moveBox(g, off, 0, 6, false).landed).toBe(false);
  });

  it('head-bump returns the tile under the body centre', () => {
    const g2 = grid([
      '........',
      '..B?....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '########',
    ]);
    // Centre over column 3 (x 48..64) while also touching column 2.
    const b = box(46, 40);
    const r = moveBox(g2, b, 0, -20);
    expect(r.hitTop).toEqual({ tx: 3, ty: 1 });
    expect(b.y).toBe(32);
    const c = box(42, 40);
    expect(moveBox(g2, c, 0, -20).hitTop).toEqual({ tx: 2, ty: 1 });
    // When only one overlapped tile is solid, that one is returned even if off-centre.
    const g3 = grid([
      '........',
      '..B.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '########',
    ]);
    const d = box(44, 40);
    expect(moveBox(g3, d, 0, -20).hitTop).toEqual({ tx: 2, ty: 1 });
  });

  it('overlaps, setTile and forEachOverlappedTile', () => {
    expect(overlaps(box(0, 0), box(9, 13))).toBe(true);
    expect(overlaps(box(0, 0), box(10, 0))).toBe(false);
    const g2 = grid([
      'oo......',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '########',
    ]);
    setTile(g2, 1, 0, Tile.Empty);
    setTile(g2, 99, 0, Tile.Ground);
    const seen: string[] = [];
    forEachOverlappedTile(g2, box(-5, -5, 30, 20), (tx, ty, id) => seen.push(`${tx},${ty},${id}`));
    expect(seen).toEqual(['0,0,9', '1,0,0']);
  });
});
