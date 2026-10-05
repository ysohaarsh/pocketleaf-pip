import { TRANSPARENT, type Sprite } from '../../game/types';

/** Legal characters in a sprite row: shades 0 (darkest) … 3 (lightest) and '.' (transparent). */
const LEGAL = /^[0-3.]+$/;

/**
 * Convert palette-index rows into a {@link Sprite}. Throws when rows are ragged, empty or contain
 * anything other than `0`–`3` and `.`, so bad art fails loudly at module load.
 */
export function sprite(rows: readonly string[], name = 'sprite'): Sprite {
  const h = rows.length;
  if (h === 0) throw new Error(`${name}: no rows`);
  const w = rows[0]!.length;
  if (w === 0) throw new Error(`${name}: empty row`);
  const pixels = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    if (row.length !== w) {
      throw new Error(`${name}: row ${y} has width ${row.length}, expected ${w}`);
    }
    if (!LEGAL.test(row)) throw new Error(`${name}: row ${y} has illegal characters: "${row}"`);
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      pixels[y * w + x] = ch === '.' ? TRANSPARENT : ch.charCodeAt(0) - 48;
    }
  });
  return { w, h, pixels };
}

/** Return a copy of `base` with the given rows (by index) replaced. */
export function patchRows(
  base: readonly string[],
  patches: Readonly<Record<number, string>>,
): string[] {
  return base.map((row, y) => patches[y] ?? row);
}
