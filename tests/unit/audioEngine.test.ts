import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from '../../src/audio';
import { createBrowserContext, volumeToGain } from '../../src/audio/engine';
import { SFX } from '../../src/audio/sfx';
import { FakeContext, FakeTimers, type FakeGain } from './audioFakeContext';

function setup() {
  const ctx = new FakeContext();
  const timers = new FakeTimers();
  const createContext = vi.fn(() => ctx);
  const engine = createAudioEngine({ createContext, timers });
  /** Master is the first gain the chip creates. */
  const master = () => ctx.gains[0] as FakeGain;
  return { ctx, timers, engine, createContext, master };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAudioEngine before unlock', () => {
  it('creates no context and treats every call as a safe no-op', () => {
    const { engine, createContext, ctx, timers } = setup();
    engine.playSfx('jump');
    engine.playMusic('grass');
    engine.setVolume(0.5);
    engine.setMuted(true);
    expect(createContext).not.toHaveBeenCalled();
    expect(engine.unlocked).toBe(false);
    expect(ctx.sources).toHaveLength(0);
    expect(timers.live.size).toBe(0);
  });

  it('is a silent engine when Web Audio is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(createBrowserContext()).toBeNull();
    const engine = createAudioEngine();
    await expect(engine.unlock()).resolves.toBeUndefined();
    expect(engine.unlocked).toBe(false);
    engine.playMusic('title');
    engine.playSfx('coin');
    engine.dispose();
  });

  it('falls back to webkitAudioContext and survives a throwing constructor', () => {
    const made: FakeContext[] = [];
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal(
      'webkitAudioContext',
      class extends FakeContext {
        constructor() {
          super();
          made.push(this);
        }
      },
    );
    expect(createBrowserContext()).toBe(made[0]);
    vi.stubGlobal(
      'AudioContext',
      class extends FakeContext {
        constructor() {
          super();
          throw new Error('blocked');
        }
      },
    );
    expect(createBrowserContext()).toBeNull();
  });
});

describe('unlock', () => {
  it('creates and resumes the context once, then starts the remembered song', async () => {
    const { engine, createContext, ctx, timers, master } = setup();
    engine.setVolume(0.5);
    engine.playMusic('grass');
    await engine.unlock();
    await engine.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(ctx.resumes).toBe(1);
    expect(engine.unlocked).toBe(true);
    expect(timers.live.size).toBe(1);
    expect(ctx.sources.length).toBeGreaterThan(0); // first steps scheduled immediately
    expect(master().gain.last).toBeCloseTo(volumeToGain(0.5), 9);
  });

  it('resumes again if the context was suspended later', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    ctx.state = 'interrupted';
    expect(engine.unlocked).toBe(false);
    await engine.unlock();
    expect(ctx.resumes).toBe(2);
    expect(engine.unlocked).toBe(true);
  });

  it('swallows a rejected resume', async () => {
    const { engine, ctx } = setup();
    ctx.resume = () => Promise.reject(new Error('not allowed'));
    await expect(engine.unlock()).resolves.toBeUndefined();
    expect(engine.unlocked).toBe(false);
  });
});

describe('music', () => {
  it('keeps scheduling notes ahead of the audio clock', async () => {
    const { engine, ctx, timers } = setup();
    await engine.unlock();
    engine.playMusic('grass');
    const startCount = ctx.sources.length;
    for (let i = 0; i < 40; i++) {
      ctx.currentTime += 0.025;
      timers.fire();
    }
    expect(ctx.sources.length).toBeGreaterThan(startCount);
    for (const s of ctx.sources) expect(s.starts[0]).toBeLessThan(ctx.currentTime + 0.1 + 1e-9);
  });

  it('playing the same song again is a no-op; switching stops the old voices', async () => {
    const { engine, ctx, timers } = setup();
    await engine.unlock();
    engine.playMusic('title');
    const first = [...ctx.sources];
    const timerIds = [...timers.live.keys()];
    engine.playMusic('title');
    expect(ctx.sources).toEqual(first);
    expect([...timers.live.keys()]).toEqual(timerIds);
    for (const s of first) expect(s.stops).toHaveLength(1);

    ctx.currentTime = 0.01;
    engine.playMusic('cave');
    for (const s of first) expect(s.stops.at(-1)).toBe(0.01);
    expect(timers.live.size).toBe(1);
    expect([...timers.live.keys()]).not.toEqual(timerIds);
    expect(ctx.sources.length).toBeGreaterThan(first.length);
  });

  it('playMusic(null) stops music and the timer', async () => {
    const { engine, ctx, timers } = setup();
    await engine.unlock();
    engine.playMusic('sky');
    const playing = [...ctx.sources];
    engine.playMusic(null);
    expect(timers.live.size).toBe(0);
    for (const s of playing) expect(s.stops.length).toBe(2);
  });

  it('a song requested and cleared before unlock never starts', async () => {
    const { engine, timers } = setup();
    engine.playMusic('grass');
    engine.playMusic(null);
    await engine.unlock();
    expect(timers.live.size).toBe(0);
  });

  it('plays the cave echo as a delayed quieter copy', async () => {
    const { engine, ctx, timers } = setup();
    await engine.unlock();
    engine.playMusic('cave');
    for (let i = 0; i < 400; i++) {
      ctx.currentTime += 0.025;
      timers.fire();
    }
    // Wave-channel oscillators come in (note, echo) pairs 0.49 s apart.
    const starts = ctx.oscillators.map((o) => o.starts[0] ?? -1);
    const echoes = starts.filter((t) => starts.some((u) => Math.abs(t - u - 0.49) < 1e-9));
    expect(echoes.length).toBeGreaterThan(0);
  });
});

describe('sfx', () => {
  it('plays every SFX after unlock on the SFX bus', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    let expected = 0;
    for (const id of Object.keys(SFX) as (keyof typeof SFX)[]) {
      engine.playSfx(id);
      expected += SFX[id].notes.length;
    }
    expect(ctx.sources).toHaveLength(expected);
  });

  it('cuts the previous SFX on the same channel and ducks that music channel', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    engine.playSfx('hurt');
    const hurt = ctx.sources[0]!;
    ctx.currentTime = 0.1;
    engine.playSfx('jump');
    expect(hurt.stops.at(-1)).toBe(0.1);
    // Gains: master, music, sfx, then 4 channel gains in CHANNELS order (pulse1 first).
    const pulse1 = ctx.gains[3] as FakeGain;
    expect(pulse1.gain.calls.slice(-3)).toEqual([
      ['cancel', 0, 0.1],
      ['set', 0, 0.1],
      ['set', 1, expect.closeTo(0.1 + 0.16, 9)],
    ]);
  });
});

describe('volume and mute', () => {
  it('ramps the master gain with a perceptual curve and mutes to 0', async () => {
    const { engine, ctx, master } = setup();
    await engine.unlock();
    ctx.currentTime = 2;
    engine.setVolume(0.5);
    expect(master().gain.calls.slice(-3)).toEqual([
      ['cancel', 0, 2],
      ['set', master().gain.value, 2],
      ['linear', 0.25, 2.04],
    ]);
    engine.setMuted(true);
    expect(master().gain.last).toBe(0);
    engine.setVolume(0.8);
    expect(master().gain.last).toBe(0); // still muted
    engine.setMuted(false);
    expect(master().gain.last).toBeCloseTo(0.64, 9);
    engine.setVolume(7);
    expect(master().gain.last).toBe(1);
    engine.setVolume(Number.NaN);
    expect(master().gain.last).toBe(0);
  });

  it('applies a mute requested before unlock', async () => {
    const { engine, master } = setup();
    engine.setMuted(true);
    await engine.unlock();
    expect(master().gain.last).toBe(0);
  });
});

describe('dispose', () => {
  it('stops everything, closes the context and ignores later calls', async () => {
    const { engine, ctx, timers, createContext } = setup();
    await engine.unlock();
    engine.playMusic('ending');
    engine.dispose();
    expect(timers.live.size).toBe(0);
    expect(ctx.closed).toBe(true);
    expect(engine.unlocked).toBe(false);
    const count = ctx.sources.length;
    engine.playSfx('coin');
    engine.playMusic('title');
    await engine.unlock();
    expect(ctx.sources).toHaveLength(count);
    expect(createContext).toHaveBeenCalledTimes(1);
    engine.dispose();
  });
});
