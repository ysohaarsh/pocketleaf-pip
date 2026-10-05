import { LEVEL_ROWS } from '../constants';

/**
 * A vertical slice of a level: exactly LEVEL_ROWS rows of equal width. Levels are authored as a
 * left-to-right sequence of segments so each idea (a pit, a block row, a staircase) reads on its own.
 */
export type Segment = readonly string[];

/**
 * Concatenate segments horizontally into a full level map. Throws if any segment does not have
 * exactly LEVEL_ROWS rows of equal width, so malformed authoring fails at module load.
 */
export function joinSegments(...segments: readonly Segment[]): string[] {
  const rows: string[] = Array.from({ length: LEVEL_ROWS }, () => '');
  segments.forEach((seg, i) => {
    if (seg.length !== LEVEL_ROWS) {
      throw new Error(`segment ${i} has ${seg.length} rows, expected ${LEVEL_ROWS}`);
    }
    const w = seg[0]!.length;
    seg.forEach((row, y) => {
      if (row.length !== w)
        throw new Error(`segment ${i} row ${y} has width ${row.length}, expected ${w}`);
      rows[y] += row;
    });
  });
  return rows;
}
