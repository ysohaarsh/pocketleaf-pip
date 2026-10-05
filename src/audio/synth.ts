/**
 * A tiny 4-channel chip synth on Web Audio: two pulse channels (PeriodicWave per duty), a 4-bit
 * wavetable channel and an LFSR noise channel. Every note is its own short-lived source → envelope
 * gain → channel gain → music/SFX bus → master → speaker filters → destination.
 */
import { CHANNELS, type ChannelId, type ChipNote, type Duty, type NoiseMode } from './chip';

// ---------------------------------------------------------------------------
// Minimal structural slice of the Web Audio API we use (lets tests inject a fake context).
// ---------------------------------------------------------------------------

/** The `AudioParam` methods the synth uses. */
export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

/** Any connectable node. */
export interface NodeLike {
  connect(destination: NodeLike): unknown;
  disconnect(): void;
}

export interface GainLike extends NodeLike {
  readonly gain: ParamLike;
}

export interface FilterLike extends NodeLike {
  type: BiquadFilterType;
  readonly frequency: ParamLike;
}

/** Opaque periodic wave handle. */
export type WaveLike = object;

export interface BufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface SourceLike extends NodeLike {
  start(when: number): void;
  stop(when: number): void;
  onended: ((ev: Event) => unknown) | null;
}

export interface OscillatorLike extends SourceLike {
  readonly frequency: ParamLike;
  setPeriodicWave(wave: WaveLike): void;
}

export interface BufferSourceLike extends SourceLike {
  buffer: BufferLike | null;
  loop: boolean;
  readonly playbackRate: ParamLike;
}

/** The subset of `BaseAudioContext` the chip needs. A real `AudioContext` satisfies it. */
export interface ChipContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: NodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBufferSource(): BufferSourceLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  createPeriodicWave(real: Float32Array, imag: Float32Array): WaveLike;
  createBiquadFilter(): FilterLike;
}

// ---------------------------------------------------------------------------
// Pure waveform math
// ---------------------------------------------------------------------------

/** Fourier series (cosine `real`, sine `imag`; index 0 = DC, always 0) for a PeriodicWave. */
export interface FourierSeries {
  real: Float32Array;
  imag: Float32Array;
}

/**
 * Fourier coefficients of a ±1 pulse that is high for the first `duty` of each period.
 * a_n = 2·sin(2πnd)/(πn), b_n = 2·(1 − cos(2πnd))/(πn).
 */
export function pulseCoefficients(duty: number, harmonics = 64): FourierSeries {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    const x = 2 * Math.PI * n * duty;
    real[n] = (2 * Math.sin(x)) / (Math.PI * n);
    imag[n] = (2 * (1 - Math.cos(x))) / (Math.PI * n);
  }
  return { real, imag };
}

/** The wave channel's 32-step, 4-bit table: a soft, slightly hollow triangle-ish bass. */
export const WAVE_TABLE: readonly number[] = [
  0, 2, 4, 6, 8, 10, 12, 14, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2,
  1, 0, 0,
];

/** DFT of a 4-bit wavetable (values 0..15, centred to ±1) up to the Nyquist harmonic. */
export function wavetableCoefficients(table: readonly number[]): FourierSeries {
  const n = table.length;
  const harmonics = Math.floor(n / 2);
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let h = 1; h <= harmonics; h++) {
    let a = 0;
    let b = 0;
    for (let k = 0; k < n; k++) {
      const x = (table[k] ?? 0) / 7.5 - 1;
      const phase = (2 * Math.PI * h * k) / n;
      a += x * Math.cos(phase);
      b += x * Math.sin(phase);
    }
    real[h] = (2 * a) / n;
    imag[h] = (2 * b) / n;
  }
  return { real, imag };
}

/**
 * Deterministic LFSR noise as ±1 samples. 15-bit mode has period 32767 ("white");
 * 7-bit mode feeds back into bit 6 too, giving a 127-step loop ("metallic").
 */
export function lfsrNoise(mode: NoiseMode, length?: number): Float32Array {
  const len = length ?? (mode === 'white' ? 32767 : 127);
  const out = new Float32Array(len);
  let reg = 0x7fff;
  for (let i = 0; i < len; i++) {
    out[i] = reg & 1 ? -1 : 1;
    const bit = (reg ^ (reg >> 1)) & 1;
    reg = (reg >> 1) | (bit << 14);
    if (mode === 'metallic') reg = (reg & ~0x40) | (bit << 6);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The chip
// ---------------------------------------------------------------------------

/** A playing note. */
export interface Voice {
  /** Audio time when the voice is fully silent. */
  readonly end: number;
  /** Silence the voice at `when` (default: now). Safe to call more than once. */
  stop(when?: number): void;
}

/** The mixer graph plus a note player. */
export interface Chip {
  readonly ctx: ChipContext;
  readonly master: GainLike;
  readonly music: GainLike;
  readonly sfx: GainLike;
  /** Per-channel music gains (used to duck music under SFX like real hardware). */
  readonly musicChannels: Readonly<Record<ChannelId, GainLike>>;
  /** Schedule one note at audio time `time` into `bus` (a music channel gain or `sfx`). */
  play(channel: ChannelId, note: ChipNote, time: number, bus: NodeLike): Voice;
  /** Disconnect the whole graph. */
  dispose(): void;
}

const MIN_GAIN = 0.0001;
const SPEAKER_HIGHPASS_HZ = 90;
const SPEAKER_LOWPASS_HZ = 7500;

/** Build the mixer graph on `ctx`. Master gain starts at 0; the engine ramps it. */
export function createChip(ctx: ChipContext): Chip {
  const master = ctx.createGain();
  master.gain.value = 0;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = SPEAKER_HIGHPASS_HZ;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = SPEAKER_LOWPASS_HZ;
  master.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(ctx.destination);

  const music = ctx.createGain();
  music.gain.value = 0.7;
  music.connect(master);
  const sfx = ctx.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);

  const musicChannels = {} as Record<ChannelId, GainLike>;
  for (const ch of CHANNELS) {
    const g = ctx.createGain();
    g.connect(music);
    musicChannels[ch] = g;
  }

  const pulseWaves = new Map<Duty, WaveLike>();
  const pulseWave = (duty: Duty): WaveLike => {
    let w = pulseWaves.get(duty);
    if (!w) {
      const { real, imag } = pulseCoefficients(duty);
      w = ctx.createPeriodicWave(real, imag);
      pulseWaves.set(duty, w);
    }
    return w;
  };
  let tableWave: WaveLike | null = null;
  const noiseBuffers = new Map<NoiseMode, BufferLike>();
  const noiseBuffer = (mode: NoiseMode): BufferLike => {
    let b = noiseBuffers.get(mode);
    if (!b) {
      const data = lfsrNoise(mode);
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.getChannelData(0).set(data);
      noiseBuffers.set(mode, b);
    }
    return b;
  };

  const makeSource = (
    channel: ChannelId,
    note: ChipNote,
  ): { src: SourceLike; pitch: ParamLike; divisor: number } => {
    if (channel === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(note.noise ?? 'white');
      src.loop = true;
      return { src, pitch: src.playbackRate, divisor: ctx.sampleRate };
    }
    const osc = ctx.createOscillator();
    if (channel === 'wave') {
      if (!tableWave) {
        const { real, imag } = wavetableCoefficients(WAVE_TABLE);
        tableWave = ctx.createPeriodicWave(real, imag);
      }
      osc.setPeriodicWave(tableWave);
    } else {
      osc.setPeriodicWave(pulseWave(note.duty ?? 0.5));
    }
    return { src: osc, pitch: osc.frequency, divisor: 1 };
  };

  return {
    ctx,
    master,
    music,
    sfx,
    musicChannels,
    play(channel, note, time, bus) {
      const { src, pitch, divisor } = makeSource(channel, note);
      const env = ctx.createGain();
      const peak = Math.max(MIN_GAIN, note.volume ?? 0.5);
      const gate = Math.max(0.005, note.duration);
      const attack = Math.min(note.attack ?? 0.005, gate);
      const release = note.release ?? 0.02;
      const held = Math.max(MIN_GAIN, peak * (note.sustain ?? 1));
      const end = time + gate + release;

      pitch.setValueAtTime(note.freq / divisor, time);
      if (note.freqEnd !== undefined) {
        pitch.exponentialRampToValueAtTime(Math.max(1, note.freqEnd) / divisor, time + gate);
      }
      const g = env.gain;
      g.value = 0;
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(peak, time + attack);
      g.exponentialRampToValueAtTime(held, time + gate);
      g.linearRampToValueAtTime(0, end);

      src.connect(env);
      env.connect(bus);
      let stopped = false;
      src.onended = () => {
        src.disconnect();
        env.disconnect();
      };
      src.start(time);
      src.stop(end + 0.01);
      return {
        end,
        stop(when = ctx.currentTime) {
          if (stopped) return;
          stopped = true;
          try {
            src.stop(when);
          } catch {
            // Older engines throw on a second stop(); the voice ends on its own schedule then.
          }
        },
      };
    },
    dispose() {
      for (const node of [master, highpass, lowpass, music, sfx, ...Object.values(musicChannels)]) {
        node.disconnect();
      }
    },
  };
}
