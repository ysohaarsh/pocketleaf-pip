import { describe, expect, it } from 'vitest';
import { parseUrlParams } from '../../src/shell/urlParams';

const rnd = () => 424242;

describe('parseUrlParams', () => {
  it('defaults to normal mode with a random seed', () => {
    expect(parseUrlParams('', rnd)).toEqual({ test: false, levelOverride: null, seed: 424242 });
  });

  it('test mode defaults the seed to 1 without calling the random source', () => {
    const p = parseUrlParams('?test=1', () => {
      throw new Error('should not be called');
    });
    expect(p).toEqual({ test: true, levelOverride: null, seed: 1 });
  });

  it('accepts test=true and a bare ?test flag', () => {
    expect(parseUrlParams('?test=true', rnd).test).toBe(true);
    expect(parseUrlParams('?test', rnd).test).toBe(true);
    expect(parseUrlParams('?test=0', rnd).test).toBe(false);
  });

  it('honours an explicit seed in and out of test mode', () => {
    expect(parseUrlParams('?test=1&seed=99', rnd).seed).toBe(99);
    expect(parseUrlParams('?seed=4294967295', rnd).seed).toBe(4294967295);
  });

  it('ignores invalid seeds', () => {
    expect(parseUrlParams('?seed=-3', rnd).seed).toBe(424242);
    expect(parseUrlParams('?seed=abc&test=1', rnd).seed).toBe(1);
    expect(parseUrlParams('?seed=4294967296&test=1', rnd).seed).toBe(1);
    expect(parseUrlParams('?seed=1.5&test=1', rnd).seed).toBe(1);
  });

  it('coerces the random seed to uint32', () => {
    expect(parseUrlParams('', () => -1).seed).toBe(4294967295);
  });

  it('accepts safe level ids only', () => {
    expect(parseUrlParams('?level=1-2', rnd).levelOverride).toBe('1-2');
    expect(parseUrlParams('?level=test_gaps', rnd).levelOverride).toBe('test_gaps');
    expect(parseUrlParams('?level=', rnd).levelOverride).toBeNull();
    expect(parseUrlParams('?level=%3Cscript%3E', rnd).levelOverride).toBeNull();
  });
});
