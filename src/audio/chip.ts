/**
 * Shared data types for the 4-channel chip synth: channels, voice parameters, songs and drums.
 * Pure data only — nothing here touches Web Audio.
 */

/** The four hardware-style channels. */
export type ChannelId = 'pulse1' | 'pulse2' | 'wave' | 'noise';

/** All channels in mixing order. */
export const CHANNELS: readonly ChannelId[] = ['pulse1', 'pulse2', 'wave', 'noise'];

/** Pulse duty cycles supported by the pulse channels. */
export type Duty = 0.125 | 0.25 | 0.5;

/** Noise LFSR mode: 15-bit "white" hiss or 7-bit short-period "metallic" buzz. */
export type NoiseMode = 'white' | 'metallic';

/** Timbre/envelope parameters shared by song tracks and SFX notes. */
export interface VoiceParams {
  /** Pulse duty (pulse channels only). Default 0.5. */
  duty?: Duty;
  /** Noise mode (noise channel only). Default 'white'. */
  noise?: NoiseMode;
  /** Peak level 0..1. Default 0.5. */
  volume?: number;
  /** Attack time in seconds. Default 0.005. */
  attack?: number;
  /** Fraction of peak level reached at the end of the gate (exponential decay). Default 1. */
  sustain?: number;
  /** Release time in seconds after the gate. Default 0.02. */
  release?: number;
}

/**
 * One synthesized note. For pulse/wave `freq` is the pitch in Hz; for noise it is the LFSR clock
 * rate in Hz (higher = brighter). `freqEnd` sweeps the frequency across the gate.
 */
export interface ChipNote extends VoiceParams {
  freq: number;
  freqEnd?: number;
  /** Gate length in seconds (release comes after). */
  duration: number;
}

/** Percussion hits available on the noise channel in song tracks. */
export type Drum = 'kick' | 'snare' | 'hat';

/** Noise presets used for drum tokens (`k`, `s`, `h`) in song tracks. */
export const DRUM_VOICES: Readonly<Record<Drum, ChipNote>> = {
  kick: { freq: 2600, freqEnd: 260, duration: 0.08, volume: 0.55, sustain: 0.2, noise: 'white' },
  snare: { freq: 9000, freqEnd: 5000, duration: 0.1, volume: 0.35, sustain: 0.15, noise: 'white' },
  hat: { freq: 15000, duration: 0.025, volume: 0.15, sustain: 0.3, noise: 'metallic' },
};

/** A feedback-free echo: one delayed, quieter copy of every note. */
export interface Echo {
  /** Delay in seconds. */
  delay: number;
  /** Echo level relative to the note, 0..1. */
  volume: number;
}

/** Song-track parameters: voice timbre plus an optional echo. */
export interface TrackParams extends VoiceParams {
  echo?: Echo;
}

/**
 * One channel of a song. `notes` uses the step notation parsed by `parseTrack`:
 * whitespace-separated tokens, one per step — `C5`, `F#4`, `Bb3` notes; `k` `s` `h` drums;
 * `.` rest; `-` sustain the previous note; `|` bar lines (ignored).
 */
export interface Track extends TrackParams {
  notes: string;
}

/** A looping song. All tracks must be the same number of steps. */
export interface Song {
  /** Beats per minute. */
  bpm: number;
  /** Sequencer steps per beat (e.g. 2 = eighth notes in 4/4, 3 = eighths in 6/8). */
  stepsPerBeat: number;
  /** Beats per bar. Default 4. */
  beatsPerBar?: number;
  /** Step the loop jumps back to after the last step. Default 0. */
  loopStart?: number;
  channels: Partial<Record<ChannelId, Track>>;
}
