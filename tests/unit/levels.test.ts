import { describe, expect, it } from 'vitest';
import { LEVEL_ROWS } from '../../src/game/constants';
import { parseLevel, validateLevel } from '../../src/game/levelParser';
import { joinSegments } from '../../src/game/levels/build';
import { LEVELS, TEST_LEVELS, getLevelDef } from '../../src/game/levels';
import type { LevelDef } from '../../src/game/types';

// ---------------------------------------------------------------------------
// A conservative, tile-level model of what the player can do (see levels/README.md).
// ---------------------------------------------------------------------------

/** Max rise in tiles for a held jump (56 px ≈ 3.5 tiles, rounded down). */
const MAX_RISE = 3;
/** Max horizontal tiles for a jump that rises at most 1 tile / rises 2-3 tiles / drops. */
const MAX_DX_LOW = 4;
const MAX_DX_HIGH = 3;
const MAX_DX_DROP = 4;
/** Widest allowed pit, in tiles. */
const MAX_PIT = 3;

const SOLID = new Set(['#', 'X', 'B', '?', 'S']);

interface Cell {
  x: number;
  y: number;
}

class Grid {
  readonly w: number;
  readonly h: number;
  constructor(readonly map: readonly string[]) {
    this.h = map.length;
    this.w = map[0]!.length;
  }
  at(x: number, y: number): string {
    return this.map[y]?.[x] ?? '.';
  }
  inBounds(x: number): boolean {
    return x >= 0 && x < this.w;
  }
  /** Side walls are solid; above and below the map is open. */
  solid(x: number, y: number): boolean {
    if (!this.inBounds(x)) return true;
    return SOLID.has(this.at(x, y));
  }
  oneWay(x: number, y: number): boolean {
    return this.inBounds(x) && this.at(x, y) === '=';
  }
  /** Cells the player's body cannot occupy (solids and spikes). */
  blocked(x: number, y: number): boolean {
    return this.solid(x, y) || this.at(x, y) === '^';
  }
  standable(x: number, y: number): boolean {
    if (!this.inBounds(x) || y < 0 || y >= this.h - 1) return false;
    if (this.blocked(x, y) || this.oneWay(x, y)) return false;
    return this.solid(x, y + 1) || this.oneWay(x, y + 1);
  }
  /** Column x is clear of blocking tiles for rows y0..y1 (inclusive, any order). */
  clear(x: number, y0: number, y1: number, allowOneWay = true): boolean {
    if (!this.inBounds(x)) return false;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      if (this.blocked(x, y)) return false;
      if (!allowOneWay && this.oneWay(x, y)) return false;
    }
    return true;
  }
  find(ch: string): Cell[] {
    const out: Cell[] = [];
    this.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push({ x, y });
    });
    return out;
  }
}

/** Can the player get from standable cell a to standable cell b in one move? */
function canMove(g: Grid, a: Cell, b: Cell): boolean {
  const dx = Math.abs(b.x - a.x);
  const rise = a.y - b.y;
  const step = Math.sign(b.x - a.x);
  if (rise === 0 && dx === 1) return true; // walk
  if (rise >= 0) {
    // Jump: rise in the source column, cross one row above the target, land.
    if (rise > MAX_RISE) return false;
    if (dx > (rise <= 1 ? MAX_DX_LOW : MAX_DX_HIGH)) return false;
    const top = b.y - 1;
    if (!g.clear(a.x, top, a.y) || !g.clear(b.x, top, b.y)) return false;
    for (let x = a.x + step; x !== b.x; x += step) if (!g.clear(x, top, top)) return false;
    return true;
  }
  // Drop: walk (or hop) off at the source height, then fall straight into the target column.
  if (dx > MAX_DX_DROP || dx === 0) return false;
  for (let x = a.x + step; x !== b.x; x += step) if (!g.clear(x, a.y, a.y)) return false;
  return g.clear(b.x, a.y, b.y, false);
}

/** Flood-fill every standable cell reachable from the player start. */
function reachable(g: Grid): Set<string> {
  const start = g.find('P')[0]!;
  const key = (c: Cell): string => `${c.x},${c.y}`;
  const seen = new Set([key(start)]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const a = queue.shift()!;
    for (let x = a.x - MAX_DX_LOW; x <= a.x + MAX_DX_LOW; x++) {
      for (let y = 0; y < g.h; y++) {
        const b = { x, y };
        if (seen.has(key(b)) || !g.standable(x, y) || !canMove(g, a, b)) continue;
        seen.add(key(b));
        queue.push(b);
      }
    }
  }
  return seen;
}

/** Runs of consecutive columns with no solid or one-way tile in rows 3..8. */
function pits(g: Grid): { from: number; width: number }[] {
  const out: { from: number; width: number }[] = [];
  let run = 0;
  for (let x = 0; x <= g.w; x++) {
    let open = x < g.w;
    for (let y = 3; open && y < g.h; y++) if (g.solid(x, y) || g.oneWay(x, y)) open = false;
    if (open) run++;
    else if (run > 0) {
      out.push({ from: x - run, width: run });
      run = 0;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

const ALL: readonly LevelDef[] = [...LEVELS, ...Object.values(TEST_LEVELS)];

describe('level registry', () => {
  it('exports the three campaign levels in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['1-1', '1-2', '1-3']);
    expect(LEVELS.map((l) => l.label)).toEqual(['1-1', '1-2', '1-3']);
    expect(LEVELS.map((l) => [l.theme, l.song])).toEqual([
      ['grass', 'grass'],
      ['cave', 'cave'],
      ['sky', 'sky'],
    ]);
    for (const l of LEVELS) {
      expect(l.timeLimit).toBe(300);
      expect(l.map[0]!.length).toBeGreaterThanOrEqual(160);
      expect(l.map[0]!.length).toBeLessThanOrEqual(200);
    }
  });

  it('exports keyed test levels', () => {
    expect(Object.keys(TEST_LEVELS).sort()).toEqual(['test-blocks', 'test-coins', 'test-enemies']);
    for (const [id, def] of Object.entries(TEST_LEVELS)) {
      expect(def.id).toBe(id);
      expect(def.label).toMatch(/^T-\d$/);
      expect(def.map[0]!.length).toBeGreaterThanOrEqual(20);
      expect(def.map[0]!.length).toBeLessThanOrEqual(30);
    }
  });

  it('getLevelDef searches campaign then test levels', () => {
    expect(getLevelDef('1-2')?.name).toBe('Hollowroot Caverns');
    expect(getLevelDef('test-coins')?.label).toBe('T-1');
    expect(getLevelDef('nope')).toBeUndefined();
  });

  it('pins test-level coordinates relied on by other tests', () => {
    const coins = new Grid(TEST_LEVELS['test-coins']!.map);
    expect(coins.find('P')).toEqual([{ x: 1, y: 6 }]);
    expect(coins.find('o')).toEqual([{ x: 4, y: 6 }]);
    const enemies = parseLevel(TEST_LEVELS['test-enemies']!);
    expect(enemies.spawns).toEqual([
      { kind: 'mossbug', tx: 8, ty: 6 },
      { kind: 'snapper', tx: 16, ty: 6 },
    ]);
    const blocks = new Grid(TEST_LEVELS['test-blocks']!.map);
    expect(blocks.find('?')).toEqual([{ x: 4, y: 4 }]);
    expect(blocks.find('S')).toEqual([{ x: 7, y: 4 }]);
    expect(blocks.find('B')).toEqual([{ x: 10, y: 4 }]);
  });

  it('joinSegments rejects malformed segments', () => {
    expect(() => joinSegments(['..'])).toThrow(/rows/);
    const ragged = Array.from({ length: LEVEL_ROWS }, (_, i) => (i === 3 ? '.' : '..'));
    expect(() => joinSegments(ragged)).toThrow(/row 3/);
  });
});

describe.each(ALL.map((l) => [l.id, l] as const))('level %s', (_id, def) => {
  const g = new Grid(def.map);

  it('is valid and parses', () => {
    expect(validateLevel(def)).toEqual([]);
    expect(def.map.length).toBe(LEVEL_ROWS);
    expect(() => parseLevel(def)).not.toThrow();
  });

  it('keeps the HUD rows 0-1 empty', () => {
    expect(def.map[0]).toMatch(/^\.+$/);
    expect(def.map[1]).toMatch(/^\.+$/);
  });

  it('starts the player on solid ground', () => {
    const p = g.find('P')[0]!;
    expect(g.solid(p.x, p.y + 1)).toBe(true);
  });

  it('plants the Beacon on solid ground with room for the pole', () => {
    const f = g.find('F')[0]!;
    expect(g.solid(f.x, f.y + 1)).toBe(true);
    expect(f.y).toBeGreaterThanOrEqual(4);
    for (let y = f.y - 4; y < f.y; y++) expect(g.at(f.x, y), `row ${y} above F`).toBe('.');
  });

  it('stands walking enemies on solid tiles', () => {
    for (const ch of ['m', 'x']) {
      for (const e of g.find(ch))
        expect(g.solid(e.x, e.y + 1), `${ch} at ${e.x},${e.y}`).toBe(true);
    }
  });

  it(`has no pit wider than ${MAX_PIT}`, () => {
    for (const pit of pits(g))
      expect(pit.width, `pit at column ${pit.from}`).toBeLessThanOrEqual(MAX_PIT);
  });

  it('keeps spike strips at most 2 wide', () => {
    for (const row of def.map)
      for (const run of row.match(/\^+/g) ?? []) expect(run.length).toBeLessThanOrEqual(2);
  });

  it('can reach the Beacon from the start (coarse flood fill)', () => {
    const seen = reachable(g);
    const f = g.find('F')[0]!;
    if (!seen.has(`${f.x},${f.y}`)) {
      const furthest = Math.max(...[...seen].map((k) => Number(k.split(',')[0])));
      expect.fail(`Beacon at ${f.x},${f.y} unreachable; furthest reachable column ${furthest}`);
    }
  });

  it('gives every reachable standing spot a free tile of headroom', () => {
    for (const k of reachable(g)) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      expect(g.blocked(x, y - 1), `no headroom at ${k}`).toBe(false);
    }
  });

  it('puts every item block within reach from below', () => {
    const seen = reachable(g);
    for (const b of [...g.find('?'), ...g.find('S')]) {
      const ok = [2, 3].some(
        (d) => seen.has(`${b.x},${b.y + d}`) && g.clear(b.x, b.y + 1, b.y + d),
      );
      expect(ok, `block at ${b.x},${b.y}`).toBe(true);
    }
  });
});

describe('campaign content', () => {
  const count = (def: LevelDef, ch: string): number => def.map.join('').split(ch).length - 1;

  it('gives every campaign level a Sun Seed block, enemies and Glimmers', () => {
    for (const def of LEVELS) {
      expect(count(def, 'S'), def.id).toBeGreaterThanOrEqual(1);
      expect(count(def, 'm') + count(def, 'x') + count(def, 'f'), def.id).toBeGreaterThanOrEqual(4);
      expect(count(def, 'o'), def.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('teaches 1-1 in order: block, Mossbug, Sun Seed early', () => {
    const g = new Grid(LEVELS[0]!.map);
    const first = (ch: string): number => Math.min(...g.find(ch).map((c) => c.x));
    expect(first('?')).toBeLessThan(first('m'));
    expect(first('S')).toBeGreaterThanOrEqual(25);
    expect(first('S')).toBeLessThanOrEqual(40);
    expect(first('x')).toBeGreaterThan(first('m'));
  });

  it('fills 1-3 with Flutters', () => {
    expect(count(LEVELS[2]!, 'f')).toBeGreaterThanOrEqual(3);
  });

  it('uses low ceilings and spikes in 1-2', () => {
    expect(count(LEVELS[1]!, '^')).toBeGreaterThanOrEqual(2);
    expect(LEVELS[1]!.map[2]!.includes('X')).toBe(true);
  });
});

describe('reachability model self-check', () => {
  const lvl = (row6: string, row7: string, extra: Record<number, string> = {}): Grid => {
    const blank = '.'.repeat(row6.length);
    const rows = Array.from({ length: LEVEL_ROWS }, (_, y) =>
      y === 6 ? row6 : y >= 7 ? row7 : (extra[y] ?? blank),
    );
    return new Grid(rows);
  };
  const reaches = (g: Grid): boolean => {
    const f = g.find('F')[0]!;
    return reachable(g).has(`${f.x},${f.y}`);
  };

  it('crosses a 3-wide pit but not a 5-wide one', () => {
    expect(reaches(lvl('P.......F.', '####...###'))).toBe(true);
    expect(reaches(lvl('P.......F.', '###.....##'))).toBe(false);
  });

  it('climbs a 3-tile wall but not a 4-tile one', () => {
    const wall3 = { 4: '.....#....', 5: '.....#....' };
    const wall4 = { 3: '.....#....', ...wall3 };
    expect(reaches(lvl('P....#..F.', '##########', wall3))).toBe(true);
    expect(reaches(lvl('P....#..F.', '##########', wall4))).toBe(false);
  });

  it('needs headroom to jump a spike strip', () => {
    expect(reaches(lvl('P...^^..F.', '##########'))).toBe(true);
    expect(reaches(lvl('P...^^..F.', '##########', { 5: '##########' }))).toBe(false);
  });

  it('jumps up through one-way planks', () => {
    const plank = { 3: '....F.....', 4: '....=.....' };
    expect(reaches(lvl('P.........', '##########', plank))).toBe(true);
  });
});
