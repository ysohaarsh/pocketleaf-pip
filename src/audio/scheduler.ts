/**
 * Pure note-scheduling math and a lookahead step sequencer ("tale of two clocks"): a coarse timer
 * wakes every ~25 ms and schedules every step whose audio-clock time falls before
 * `now + lookahead`. Step times are always `startTime + stepIndex * secondsPerStep`, so jittery
 * timer callbacks never accumulate drift.
 */
import { CHANNELS, type ChannelId, type Song, type TrackParams } from './chip';
import { parseTrack, type Pitch } from './notation';

/** Equal-tempered frequency of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Step indices `n >= fromStep` whose start time `startTime + n * secondsPerStep` is strictly
 * before `windowEnd`, in ascending order.
 */
export function stepsInWindow(
  startTime: number,
  secondsPerStep: number,
  fromStep: number,
  windowEnd: number,
): number[] {
  const out: number[] = [];
  for (let n = fromStep; startTime + n * secondsPerStep < windowEnd; n++) out.push(n);
  return out;
}

/** Index of the first step whose start time is at or after `time` (never negative). */
export function firstStepAtOrAfter(
  startTime: number,
  secondsPerStep: number,
  time: number,
): number {
  const n = Math.ceil((time - startTime) / secondsPerStep - 1e-9);
  return Math.max(0, n);
}

/**
 * Map an ever-increasing absolute step to a position in a song of `length` steps that loops
 * back to `loopStart` after its last step.
 */
export function songStepAt(absStep: number, length: number, loopStart: number): number {
  if (absStep < length) return absStep;
  return loopStart + ((absStep - length) % (length - loopStart));
}

/** A note ready for the sequencer, indexed by its song step. */
export interface CompiledNote {
  channel: ChannelId;
  pitch: Pitch;
  steps: number;
  params: TrackParams;
}

/** A song parsed and validated for playback. */
export interface CompiledSong {
  secondsPerStep: number;
  /** Total steps. */
  length: number;
  loopStart: number;
  /** Notes starting at each step (`byStep.length === length`). */
  byStep: readonly (readonly CompiledNote[])[];
}

/**
 * Parse every track of a song and index notes by step.
 * @throws Error if tracks differ in length, the song is empty, or `loopStart` is out of range.
 */
export function compileSong(song: Song): CompiledSong {
  let length = -1;
  const byStep: CompiledNote[][] = [];
  for (const channel of CHANNELS) {
    const track = song.channels[channel];
    if (!track) continue;
    const { notes, ...params } = track;
    const parsed = parseTrack(notes);
    if (length === -1) {
      length = parsed.length;
      for (let i = 0; i < length; i++) byStep.push([]);
    } else if (parsed.length !== length) {
      throw new Error(`track ${channel} has ${parsed.length} steps, expected ${length}`);
    }
    for (const n of parsed.notes) {
      byStep[n.step]?.push({ channel, pitch: n.pitch, steps: n.steps, params });
    }
  }
  const loopStart = song.loopStart ?? 0;
  if (length <= 0) throw new Error('song has no steps');
  if (loopStart < 0 || loopStart >= length) throw new Error(`loopStart ${loopStart} out of range`);
  return { secondsPerStep: 60 / song.bpm / song.stepsPerBeat, length, loopStart, byStep };
}

/** Called once per scheduled note with its absolute audio-clock start time and duration (s). */
export type NoteCallback = (
  channel: ChannelId,
  pitch: Pitch,
  time: number,
  duration: number,
  params: TrackParams,
) => void;

/** Dependencies for `createSequencer`; inject a fake clock and timers in tests. */
export interface SequencerOptions<H> {
  /** Audio-clock time in seconds (e.g. `ctx.currentTime`). */
  now: () => number;
  /** Start a repeating timer (e.g. `setInterval`). */
  setTimer: (cb: () => void, ms: number) => H;
  clearTimer: (handle: H) => void;
  onNote: NoteCallback;
  /** How far ahead to schedule, seconds. Default 0.1. */
  lookahead?: number;
  /** Timer period, ms. Default 25. */
  intervalMs?: number;
}

/** A lookahead step sequencer. */
export interface Sequencer {
  /** Start looping `song` with step 0 at audio time `atTime`. Replaces any current song. */
  start(song: CompiledSong, atTime: number): void;
  /** Stop scheduling. Already-scheduled notes are the caller's to silence. */
  stop(): void;
  readonly playing: boolean;
  /** Run one scheduling pass now (the timer calls this). */
  tick(): void;
}

/** Create a lookahead sequencer driven by an injected clock and timer. */
export function createSequencer<H>(opts: SequencerOptions<H>): Sequencer {
  const lookahead = opts.lookahead ?? 0.1;
  const intervalMs = opts.intervalMs ?? 25;
  let song: CompiledSong | null = null;
  let startTime = 0;
  let nextStep = 0;
  let timer: { handle: H } | null = null;

  const tick = (): void => {
    if (!song) return;
    const spb = song.secondsPerStep;
    const now = opts.now();
    // After a stall (background tab), skip steps already in the past instead of bursting them.
    const from = Math.max(nextStep, firstStepAtOrAfter(startTime, spb, now));
    for (const n of stepsInWindow(startTime, spb, from, now + lookahead)) {
      const time = startTime + n * spb;
      const notes = song.byStep[songStepAt(n, song.length, song.loopStart)] ?? [];
      for (const note of notes) {
        opts.onNote(note.channel, note.pitch, time, note.steps * spb, note.params);
      }
      nextStep = n + 1;
    }
    nextStep = Math.max(nextStep, from);
  };

  const stop = (): void => {
    if (timer) opts.clearTimer(timer.handle);
    timer = null;
    song = null;
  };

  return {
    start(next, atTime) {
      stop();
      song = next;
      startTime = atTime;
      nextStep = 0;
      timer = { handle: opts.setTimer(tick, intervalMs) };
      tick();
    },
    stop,
    get playing() {
      return song !== null;
    },
    tick,
  };
}
