import type { LevelDef, ParsedLevel } from './types';

// STUB — replaced by feat/content.
export function parseLevel(def: LevelDef): ParsedLevel {
  const height = def.map.length;
  const width = def.map[0]?.length ?? 0;
  return {
    def,
    width,
    height,
    tiles: new Uint8Array(width * height),
    spawns: [],
    start: { tx: 1, ty: height - 3 },
    beacon: { tx: width - 2, ty: height - 3 },
  };
}
