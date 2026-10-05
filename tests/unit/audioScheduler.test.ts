import { describe, expect, it } from 'vitest';
import type { ChannelId, Song } from '../../src/audio/chip';
import type { Pitch } from '../../src/audio/notation';
import {
  compileSong,
  createSequencer,
  firstStepAtOrAfter,
  midiToFreq,
  songStepAt,
  stepsInWindow,
} from '../../src/audio/scheduler';

describe('midiToFreq', () => {
  it('tunes A4 to 440 Hz and doubles per octave', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(81)).toBeCloseTo(880, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
  });
});

describe('stepsInWindow', () => {
  it('returns steps strictly before the window end', () => {
    expect(stepsInWindow(1, 0.25, 0, 1.6)).toEqual([0, 1, 2]);
    expect(stepsInWindow(1, 0.25, 0, 1.5)).toEqual([0, 1]);
    expect(stepsInWindow(1, 0.25, 2, 1.6)).toEqual([2]);
    expect(stepsInWindow(1, 0.25, 3, 1.6)).toEqual([]);
    expect(stepsInWindow(1, 0.25, 0, 0.5)).toEqual([]);
  });
});

describe('firstStepAtOrAfter / songStepAt', () => {
  it('finds the first step not in the past', () => {
    expect(firstStepAtOrAfter(1, 0.25, 0)).toBe(0);
    expect(firstStepAtOrAfter(1, 0.25, 1.5)).toBe(2);
    expect(firstStepAtOrAfter(1, 0.25, 1.51)).toBe(3);
    expect(firstStepAtOrAfter(0, 0.1, 0.3)).toBe(3); // float-safe: 3 * 0.1 !== 0.3
  });

  it('wraps to the loop start', () => {
    const at = (n: number) => songStepAt(n, 8, 2);
    expect([0, 1, 7, 8, 9, 13, 14, 15].map(at)).toEqual([0, 1, 7, 2, 3, 7, 2, 3]);
    expect(songStepAt(16, 8, 0)).toBe(0);
  });
});

describe('compileSong', () => {
  it('indexes notes by step and computes seconds per step', () => {
    const c = compileSong({
      bpm: 120,
      stepsPerBeat: 2,
      loopStart: 1,
      channels: { pulse1: { notes: 'C4 - . E4' }, noise: { notes: 'k . s .' } },
    });
    expect(c.secondsPerStep).toBe(0.25);
    expect(c.length).toBe(4);
    expect(c.loopStart).toBe(1);
    expect(c.byStep[0]?.map((n) => n.channel)).toEqual(['pulse1', 'noise']);
    expect(c.byStep[0]?.[0]?.steps).toBe(2);
    expect(c.byStep[1]).toEqual([]);
  });

  it('rejects mismatched tracks, empty songs and bad loop points', () => {
    expect(() =>
      compileSong({
        bpm: 120,
        stepsPerBeat: 2,
        channels: { pulse1: { notes: 'C4' }, wave: { notes: 'C4 .' } },
      }),
    ).toThrow(/expected 1/);
    expect(() => compileSong({ bpm: 120, stepsPerBeat: 2, channels: {} })).toThrow(/no steps/);
    expect(() =>
      compileSong({
        bpm: 120,
        stepsPerBeat: 2,
        loopStart: 2,
        channels: { wave: { notes: 'C4 .' } },
      }),
    ).toThrow(/loopStart/);
  });
});

interface Hit {
  channel: ChannelId;
  pitch: Pitch;
  time: number;
  duration: number;
}

/** A sequencer on a fake clock; `advance(dt)` moves the clock and fires the timer. */
function harness(song: Song, lookahead = 0.1) {
  let now = 0;
  const hits: Hit[] = [];
  const timers = new Map<number, () => void>();
  let nextId = 1;
  const seq = createSequencer<number>({
    now: () => now,
    setTimer: (cb, ms) => {
      expect(ms).toBe(25);
      timers.set(nextId, cb);
      return nextId++;
    },
    clearTimer: (h) => timers.delete(h),
    onNote: (channel, pitch, time, duration) => hits.push({ channel, pitch, time, duration }),
    lookahead,
  });
  return {
    seq,
    hits,
    timers,
    compiled: compileSong(song),
    advance(dt: number) {
      now += dt;
      for (const cb of [...timers.values()]) cb();
    },
    get now() {
      return now;
    },
  };
}

const EVERY_STEP: Song = {
  bpm: 120,
  stepsPerBeat: 2, // 0.25 s per step
  channels: { pulse1: { notes: 'C4 D4 E4 F4 G4 A4 B4 C5' } },
};

describe('createSequencer', () => {
  it('schedules notes at start + n * secondsPerStep within the lookahead window', () => {
    const h = harness(EVERY_STEP, 0.125);
    h.seq.start(h.compiled, 0.0625);
    // Window at t=0 is [0, 0.125): only step 0 (0.0625). Binary-exact times avoid float noise.
    expect(h.hits.map((x) => x.time)).toEqual([0.0625]);
    expect(h.hits[0]?.duration).toBe(0.25);
    h.advance(0.0625); // window end 0.1875: nothing
    h.advance(0.0625); // window end 0.25: nothing
    expect(h.hits).toHaveLength(1);
    h.advance(0.0625); // window end 0.3125: step 1 at 0.3125 is NOT < 0.3125
    expect(h.hits).toHaveLength(1);
    h.advance(0.03125); // window end 0.34375: step 1
    expect(h.hits.map((x) => x.time)).toEqual([0.0625, 0.3125]);
    for (const hit of h.hits) expect(hit.time).toBeLessThan(h.now + 0.125);
  });

  it('never schedules a step twice or late and does not drift over 1000 steps of jitter', () => {
    const h = harness(EVERY_STEP, 0.1);
    const start = 0.05;
    h.seq.start(h.compiled, start);
    // Deterministic jitter: callbacks arrive 10–55 ms apart.
    let seed = 12345;
    while (h.hits.length < 1000) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const before = h.hits.length;
      const tickAt = h.now + 0.01 + (seed / 2147483648) * 0.045;
      h.advance(tickAt - h.now);
      for (const hit of h.hits.slice(before)) {
        expect(hit.time).toBeGreaterThanOrEqual(h.now);
        expect(hit.time).toBeLessThan(h.now + 0.1);
      }
    }
    h.hits.forEach((hit, n) => {
      expect(hit.time).toBe(start + n * 0.25);
    });
    // Pitches loop through the 8-step track.
    expect(h.hits[999]?.pitch).toEqual(h.hits[999 % 8]?.pitch);
  });

  it('wraps at the loop point', () => {
    const h = harness({
      bpm: 120,
      stepsPerBeat: 2,
      loopStart: 2,
      channels: { wave: { notes: 'C3 D3 E3 F3' } },
    });
    h.seq.start(h.compiled, 0);
    for (let i = 0; i < 80; i++) h.advance(0.025);
    const midis = h.hits.map((x) => (x.pitch.kind === 'tone' ? x.pitch.midi : -1));
    expect(midis.slice(0, 8)).toEqual([48, 50, 52, 53, 52, 53, 52, 53]);
    expect(h.hits.map((x) => x.time).slice(0, 8)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
  });

  it('skips steps already in the past after a timer stall instead of bursting them', () => {
    const h = harness(EVERY_STEP);
    h.seq.start(h.compiled, 0);
    h.advance(5); // a 5 s stall
    const late = h.hits.filter((x) => x.time > 0);
    expect(late.length).toBeLessThanOrEqual(1);
    for (const x of late) expect(x.time).toBeGreaterThanOrEqual(5);
    h.advance(0.025);
    expect(h.hits[h.hits.length - 1]?.time).toBe(5);
  });

  it('stop clears the timer and schedules nothing more; start replaces the song', () => {
    const h = harness(EVERY_STEP);
    h.seq.start(h.compiled, 0);
    h.seq.start(h.compiled, 0); // restart must not leak a second timer
    expect(h.timers.size).toBe(1);
    expect(h.seq.playing).toBe(true);
    h.seq.stop();
    expect(h.seq.playing).toBe(false);
    expect(h.timers.size).toBe(0);
    const count = h.hits.length;
    h.seq.tick();
    h.advance(1);
    expect(h.hits).toHaveLength(count);
  });
});
