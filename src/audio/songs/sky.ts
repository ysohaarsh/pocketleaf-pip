import type { Song } from '../chip';
import { perChord, repeat } from './patterns';

/** One chord per bar (F major), 6/8. */
const CHORDS = ['F', 'F', 'Gm', 'C', 'F', 'Bb', 'C', 'F', 'Bb', 'Dm', 'C', 'F'];

const MELODY = [
  'C5 - F5 A5 - G5',
  'F5 - - C5 - .',
  'D5 - G5 Bb5 - A5',
  'G5 - - - - .',
  'A5 - G5 F5 - E5',
  'D5 - E5 F5 - G5',
  'E5 - C5 G5 - E5',
  'F5 - - - - .',
  'Bb5 - A5 G5 - F5',
  'A5 - G5 F5 - D5',
  'C5 - F5 E5 - G5',
  'F5 - - - - .',
].join(' | ');

const ARPS: Readonly<Record<string, string>> = {
  F: 'F4 A4 C5 A4 C5 A4',
  Gm: 'G4 Bb4 D5 Bb4 D5 Bb4',
  C: 'E4 G4 C5 G4 C5 G4',
  Bb: 'F4 Bb4 D5 Bb4 D5 Bb4',
  Dm: 'F4 A4 D5 A4 D5 A4',
};

const BASS: Readonly<Record<string, string>> = {
  F: 'F2 - - C3 - -',
  Gm: 'G2 - - D3 - -',
  C: 'C3 - - G2 - -',
  Bb: 'Bb2 - - F3 - -',
  Dm: 'D3 - - A2 - -',
};

/** Level 1-3: airy, lilting 6/8 float, 76 dotted-quarter bpm, 12 bars. */
export const SKY: Song = {
  bpm: 76,
  stepsPerBeat: 3,
  beatsPerBar: 2,
  channels: {
    pulse1: { notes: MELODY, duty: 0.125, volume: 0.3, attack: 0.02, sustain: 0.7 },
    pulse2: { notes: perChord(CHORDS, ARPS), duty: 0.25, volume: 0.1, sustain: 0.3 },
    wave: { notes: perChord(CHORDS, BASS), volume: 0.45, sustain: 0.6 },
    noise: { notes: repeat('h . . h . .', 12) },
  },
};
