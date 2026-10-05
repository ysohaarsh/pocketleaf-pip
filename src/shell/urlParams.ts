/** Options the shell derives from the page URL before creating the game host. */
export interface UrlParams {
  /** `?test=1` — deterministic test mode. */
  test: boolean;
  /** `?level=<id>` — start straight into a level. */
  levelOverride: string | null;
  /** `?seed=<n>` — PRNG seed (uint32). Defaults to 1 in test mode, random otherwise. */
  seed: number;
}

const LEVEL_ID = /^[A-Za-z0-9_-]{1,32}$/;
const UINT = /^\d{1,10}$/;

function isTruthyFlag(value: string | null): boolean {
  return value === '1' || value === 'true' || value === '';
}

/** Pure URL parsing; `randomSeed` is only called when no valid seed is given outside test mode. */
export function parseUrlParams(search: string, randomSeed: () => number): UrlParams {
  const params = new URLSearchParams(search);
  const test = isTruthyFlag(params.get('test'));

  const level = params.get('level');
  const levelOverride = level !== null && LEVEL_ID.test(level) ? level : null;

  const rawSeed = params.get('seed');
  let seed: number;
  if (rawSeed !== null && UINT.test(rawSeed) && Number(rawSeed) <= 0xffffffff) {
    seed = Number(rawSeed);
  } else {
    seed = test ? 1 : randomSeed() >>> 0;
  }

  return { test, levelOverride, seed };
}
