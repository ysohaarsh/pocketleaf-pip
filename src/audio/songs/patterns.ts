/** Small helpers for writing song tracks in step notation. */

/** Repeat a bar of step notation `times` times, separated by bar lines. */
export function repeat(bar: string, times: number): string {
  return Array.from({ length: times }, () => bar).join(' | ');
}

/** Expand a chord progression (one chord per bar) through a chord → bar pattern table. */
export function perChord(
  chords: readonly string[],
  table: Readonly<Record<string, string>>,
): string {
  return chords
    .map((c) => {
      const bar = table[c];
      if (bar === undefined) throw new Error(`no pattern for chord ${c}`);
      return bar;
    })
    .join(' | ');
}
