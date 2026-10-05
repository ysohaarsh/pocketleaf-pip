import { describe, expect, it } from 'vitest';
import {
  WAVE_TABLE,
  createChip,
  lfsrNoise,
  pulseCoefficients,
  wavetableCoefficients,
} from '../../src/audio/synth';
import { FakeBufferSource, FakeContext, FakeOscillator } from './audioFakeContext';

describe('pulseCoefficients', () => {
  it('gives a square wave (50%) odd harmonics 4/(πn) and no even harmonics', () => {
    const { real, imag } = pulseCoefficients(0.5, 16);
    expect(real[0]).toBe(0);
    expect(imag[0]).toBe(0);
    for (let n = 1; n <= 16; n++) {
      expect(real[n]).toBeCloseTo(0, 6);
      expect(imag[n]).toBeCloseTo(n % 2 ? 4 / (Math.PI * n) : 0, 6);
    }
  });

  it('gives narrower duties more relative high-harmonic energy', () => {
    const mag = (d: number, n: number) => {
      const { real, imag } = pulseCoefficients(d, 8);
      return Math.hypot(real[n] ?? 0, imag[n] ?? 0);
    };
    // 25% duty: every 4th harmonic vanishes.
    expect(mag(0.25, 4)).toBeCloseTo(0, 6);
    expect(mag(0.25, 2)).toBeGreaterThan(0.1);
    // 12.5%: harmonic 2 is relatively stronger than for a square wave.
    expect(mag(0.125, 2) / mag(0.125, 1)).toBeGreaterThan(0.8);
    // Magnitude of harmonic n is |4 sin(πnd)| / (πn).
    expect(mag(0.125, 3)).toBeCloseTo(
      (4 * Math.abs(Math.sin(Math.PI * 3 * 0.125))) / (3 * Math.PI),
      6,
    );
  });
});

describe('wavetableCoefficients', () => {
  it('reconstructs the 4-bit table from its series', () => {
    const { real, imag } = wavetableCoefficients(WAVE_TABLE);
    expect(real).toHaveLength(17);
    const mean = WAVE_TABLE.reduce((a, b) => a + b, 0) / WAVE_TABLE.length / 7.5 - 1;
    WAVE_TABLE.forEach((v, k) => {
      let x = mean;
      for (let h = 1; h < 16; h++) {
        const p = (2 * Math.PI * h * k) / 32;
        x += (real[h] ?? 0) * Math.cos(p) + (imag[h] ?? 0) * Math.sin(p);
      }
      x += ((real[16] ?? 0) / 2) * Math.cos(Math.PI * k); // Nyquist term counts once
      expect(x).toBeCloseTo(v / 7.5 - 1, 4);
    });
    expect(WAVE_TABLE.every((v) => Number.isInteger(v) && v >= 0 && v <= 15)).toBe(true);
  });
});

describe('lfsrNoise', () => {
  it('is deterministic ±1 noise', () => {
    const a = lfsrNoise('white');
    const b = lfsrNoise('white');
    expect(a).toEqual(b);
    expect(a.every((x) => x === 1 || x === -1)).toBe(true);
    const ones = a.filter((x) => x === 1).length;
    expect(Math.abs(ones / a.length - 0.5)).toBeLessThan(0.01);
  });

  it('has period 32767 in white mode and 127 in metallic mode', () => {
    const white = lfsrNoise('white', 32767 * 2);
    expect(white.subarray(32767)).toEqual(white.subarray(0, 32767));
    expect(white.subarray(1000, 1100)).not.toEqual(white.subarray(0, 100));
    expect(lfsrNoise('white')).toHaveLength(32767);

    const metal = lfsrNoise('metallic', 127 * 3);
    expect(metal.subarray(127, 254)).toEqual(metal.subarray(254, 381));
    // Shortest period of the metallic loop is 127 (after the start-up transient).
    const loop = metal.subarray(127, 254);
    for (const p of [1, 7, 63]) {
      expect(metal.subarray(127 + p, 254 + p)).not.toEqual(loop);
    }
    expect(lfsrNoise('metallic')).toHaveLength(127);
  });
});

describe('createChip', () => {
  it('routes buses through master and speaker filters to the destination', () => {
    const ctx = new FakeContext();
    const chip = createChip(ctx);
    expect(chip.master.gain.value).toBe(0);
    expect(ctx.filters.map((f) => f.type)).toEqual(['highpass', 'lowpass']);
    expect(ctx.filters[1]?.outputs).toEqual([ctx.destination]);
    expect(chip.music).not.toBe(chip.sfx);
    for (const g of Object.values(chip.musicChannels)) {
      expect((g as unknown as { outputs: unknown[] }).outputs).toEqual([chip.music]);
    }
  });

  it('plays a pulse note with envelope, sweep and cleanup, caching the duty wave', () => {
    const ctx = new FakeContext();
    const chip = createChip(ctx);
    const voice = chip.play(
      'pulse1',
      { freq: 300, freqEnd: 600, duration: 0.2, duty: 0.25, volume: 0.5, release: 0.05 },
      1,
      chip.sfx,
    );
    chip.play('pulse2', { freq: 300, duration: 0.1, duty: 0.25 }, 1, chip.sfx);
    expect(ctx.waves).toHaveLength(1);
    const osc = ctx.oscillators[0] as FakeOscillator;
    expect(osc.starts).toEqual([1]);
    expect(osc.stops[0]).toBeCloseTo(1.26, 9);
    expect(osc.frequency.calls).toEqual([
      ['set', 300, 1],
      ['exp', 600, 1.2],
    ]);
    const env = ctx.gains[ctx.gains.length - 2]!;
    expect(env.gain.calls[0]).toEqual(['set', 0, 1]);
    expect(env.gain.calls[1]).toEqual(['linear', 0.5, 1.005]);
    expect(env.gain.calls.at(-1)).toEqual(['linear', 0, 1.25]);
    expect(voice.end).toBeCloseTo(1.25, 9);

    // Voices disconnect themselves when they end (no leaks).
    osc.fireEnded();
    expect(osc.disconnects).toBe(1);
    expect(env.disconnects).toBe(1);

    voice.stop(1.1);
    voice.stop(1.15);
    expect(osc.stops.slice(1)).toEqual([1.1]);
  });

  it('plays noise from a looped LFSR buffer at a playback rate set by freq', () => {
    const ctx = new FakeContext();
    const chip = createChip(ctx);
    chip.play('noise', { freq: 4800, duration: 0.1, noise: 'metallic' }, 0, chip.sfx);
    chip.play('noise', { freq: 4800, duration: 0.1, noise: 'metallic' }, 0, chip.sfx);
    const src = ctx.bufferSources[0] as FakeBufferSource;
    expect(src.loop).toBe(true);
    expect(src.playbackRate.calls[0]).toEqual(['set', 0.1, 0]);
    expect(ctx.buffers).toHaveLength(1);
    expect(ctx.buffers[0]?.getChannelData()).toEqual(lfsrNoise('metallic'));
  });

  it('uses the wavetable on the wave channel', () => {
    const ctx = new FakeContext();
    const chip = createChip(ctx);
    chip.play('wave', { freq: 110, duration: 0.1 }, 0, chip.musicChannels.wave);
    expect(ctx.waves[0]?.real).toEqual(wavetableCoefficients(WAVE_TABLE).real);
    expect((ctx.oscillators[0] as FakeOscillator).wave).toBe(ctx.waves[0]);
  });
});
