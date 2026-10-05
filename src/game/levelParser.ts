import { LEVEL_ROWS } from './constants';
import {
  Tile,
  type LevelDef,
  type ParsedLevel,
  type Spawn,
  type SpawnKind,
  type TileId,
} from './types';

/** Map glyph → tile written into the grid. Spawn/marker glyphs become Empty. */
export const TILE_GLYPHS: Readonly<Record<string, TileId>> = {
  '.': Tile.Empty,
  '#': Tile.Ground,
  X: Tile.Hard,
  B: Tile.Brick,
  '?': Tile.CoinBlock,
  S: Tile.SeedBlock,
  '=': Tile.OneWay,
  '^': Tile.Spike,
  o: Tile.Glimmer,
};

export const SPAWN_GLYPHS: Readonly<Record<string, SpawnKind>> = {
  m: 'mossbug',
  x: 'snapper',
  f: 'flutter',
};

export const MARKER_GLYPHS = ['P', 'F'] as const;

export class LevelError extends Error {
  constructor(
    readonly levelId: string,
    readonly problems: readonly string[],
  ) {
    super(`Level ${levelId} is invalid:\n- ${problems.join('\n- ')}`);
    this.name = 'LevelError';
  }
}

/** Returns a list of problems; empty when the map is valid. */
export function validateLevel(def: LevelDef): string[] {
  const problems: string[] = [];
  const { map } = def;
  if (map.length !== LEVEL_ROWS) problems.push(`expected ${LEVEL_ROWS} rows, got ${map.length}`);
  const width = map[0]?.length ?? 0;
  if (width < 10) problems.push(`width ${width} is narrower than one screen (10 tiles)`);
  let players = 0;
  let beacons = 0;
  map.forEach((row, ty) => {
    if (row.length !== width)
      problems.push(`row ${ty} has length ${row.length}, expected ${width}`);
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx]!;
      if (ch === 'P') players++;
      else if (ch === 'F') beacons++;
      else if (!(ch in TILE_GLYPHS) && !(ch in SPAWN_GLYPHS)) {
        problems.push(`unknown glyph '${ch}' at (${tx},${ty})`);
      }
    }
  });
  if (players !== 1) problems.push(`expected exactly one P, found ${players}`);
  if (beacons !== 1) problems.push(`expected exactly one F, found ${beacons}`);
  if (def.timeLimit <= 0) problems.push('timeLimit must be positive');
  return problems;
}

/** Parse and validate an ASCII level. Throws LevelError when invalid. */
export function parseLevel(def: LevelDef): ParsedLevel {
  const problems = validateLevel(def);
  if (problems.length > 0) throw new LevelError(def.id, problems);
  const height = def.map.length;
  const width = def.map[0]!.length;
  const tiles = new Uint8Array(width * height);
  const spawns: Spawn[] = [];
  let start = { tx: 0, ty: 0 };
  let beacon = { tx: 0, ty: 0 };
  def.map.forEach((row, ty) => {
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx]!;
      const tile = TILE_GLYPHS[ch];
      if (tile !== undefined) tiles[ty * width + tx] = tile;
      const kind = SPAWN_GLYPHS[ch];
      if (kind) spawns.push({ kind, tx, ty });
      if (ch === 'P') start = { tx, ty };
      if (ch === 'F') beacon = { tx, ty };
    }
  });
  return { def, width, height, tiles, spawns, start, beacon };
}
