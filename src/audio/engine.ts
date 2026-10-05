/**
 * The AudioEngine implementation: lazily creates the AudioContext on the first user gesture,
 * plays SFX and looping songs through the chip synth, and degrades to a silent engine when
 * Web Audio is unavailable.
 */
import type { SfxId, SongId } from '../game/types';
import { DRUM_VOICES, type ChannelId, type ChipNote } from './chip';
import { compileSong, createSequencer, midiToFreq, type CompiledSong } from './scheduler';
import { SFX, sfxChannels, sfxDuration } from './sfx';
import { SONGS } from './songs';
import { createChip, type Chip, type ChipContext, type Voice } from './synth';
import type { AudioEngine } from './types';

/** Repeating-timer functions (defaults: `setInterval` / `clearInterval`). */
export interface TimerApi {
  setInterval(cb: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

/** Injectable dependencies (tests pass a fake context and timers). */
export interface AudioEngineDeps {
  /** Create the audio context; return null when unsupported. Called once, inside `unlock()`. */
  createContext?: () => ChipContext | null;
  timers?: TimerApi;
}

/** Fraction of a step a music note sounds before release (keeps repeated notes articulated). */
const GATE = 0.9;
/** Delay before the first scheduled step of a new song, seconds. */
const SONG_LEAD_IN = 0.05;
/** Master volume ramp time, seconds. */
const VOLUME_RAMP = 0.04;

type ContextCtor = new () => ChipContext;

/** Find `AudioContext` (or Safari's prefixed `webkitAudioContext`) and construct it. */
export function createBrowserContext(): ChipContext | null {
  const g = globalThis as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** Perceptual (squared) curve from a 0..1 slider to linear gain. */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
  return v * v;
}

/**
 * Create the game's audio engine. No AudioContext exists until `unlock()` runs inside a user
 * gesture; before that every call is a safe no-op (a requested song starts on unlock).
 */
export function createAudioEngine(deps: AudioEngineDeps = {}): AudioEngine {
  const makeContext = deps.createContext ?? createBrowserContext;
  const timers: TimerApi = deps.timers ?? {
    setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
    clearInterval: (h) => globalThis.clearInterval(h),
  };

  let chip: Chip | null = null;
  let disposed = false;
  let volume = 1;
  let muted = false;
  let song: SongId | null = null;
  const compiled = new Map<SongId, CompiledSong>();
  const musicVoices = new Set<Voice>();
  const sfxVoices = new Map<ChannelId, Voice[]>();

  /** Remember a music voice (so a song switch can cut it); forget voices that already ended. */
  const track = (v: Voice, now: number): void => {
    for (const old of musicVoices) if (old.end < now) musicVoices.delete(old);
    musicVoices.add(v);
  };

  const sequencer = createSequencer<number>({
    now: () => chip?.ctx.currentTime ?? 0,
    setTimer: (cb, ms) => timers.setInterval(cb, ms),
    clearTimer: (h) => timers.clearInterval(h),
    onNote(channel, pitch, time, duration, params) {
      if (!chip) return;
      const bus = chip.musicChannels[channel];
      const note: ChipNote =
        pitch.kind === 'drum'
          ? DRUM_VOICES[pitch.drum]
          : { ...params, freq: midiToFreq(pitch.midi), duration: duration * GATE };
      const now = chip.ctx.currentTime;
      track(chip.play(channel, note, time, bus), now);
      if (params.echo) {
        const echoNote = { ...note, volume: (note.volume ?? 0.5) * params.echo.volume };
        track(chip.play(channel, echoNote, time + params.echo.delay, bus), now);
      }
    },
  });

  const applyMaster = (): void => {
    if (!chip) return;
    const now = chip.ctx.currentTime;
    const g = chip.master.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(muted ? 0 : volumeToGain(volume), now + VOLUME_RAMP);
  };

  const stopMusic = (): void => {
    sequencer.stop();
    for (const v of musicVoices) v.stop();
    musicVoices.clear();
  };

  const startSong = (): void => {
    stopMusic();
    if (!chip || song === null) return;
    let c = compiled.get(song);
    if (!c) {
      c = compileSong(SONGS[song]);
      compiled.set(song, c);
    }
    sequencer.start(c, chip.ctx.currentTime + SONG_LEAD_IN);
  };

  return {
    get unlocked() {
      return chip !== null && chip.ctx.state === 'running';
    },

    async unlock() {
      if (disposed) return;
      if (!chip) {
        const ctx = makeContext();
        if (!ctx) return;
        chip = createChip(ctx);
        applyMaster();
        startSong();
      }
      if (chip.ctx.state !== 'running') {
        try {
          await chip.ctx.resume();
        } catch {
          // Not inside a gesture yet; the next gesture calls unlock() again.
        }
      }
    },

    playSfx(id: SfxId) {
      if (!chip) return;
      const def = SFX[id];
      const now = chip.ctx.currentTime;
      const length = sfxDuration(def);
      for (const ch of sfxChannels(def)) {
        // One sound per channel, like the hardware: a new SFX cuts the previous one...
        for (const v of sfxVoices.get(ch) ?? []) v.stop(now);
        sfxVoices.set(ch, []);
        // ...and mutes that channel's music until it finishes.
        const duck = chip.musicChannels[ch].gain;
        duck.cancelScheduledValues(now);
        duck.setValueAtTime(0, now);
        duck.setValueAtTime(1, now + length);
      }
      for (const { channel, at, note } of def.notes) {
        sfxVoices.get(channel)?.push(chip.play(channel, note, now + at, chip.sfx));
      }
    },

    playMusic(next: SongId | null) {
      if (disposed || next === song) return;
      song = next;
      startSong();
    },

    setVolume(v: number) {
      volume = v;
      applyMaster();
    },

    setMuted(m: boolean) {
      muted = m;
      applyMaster();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stopMusic();
      song = null;
      if (chip) {
        chip.dispose();
        chip.ctx.close().catch(() => undefined);
        chip = null;
      }
    },
  };
}
