import type { Song } from '../chip';
import { perChord, repeat } from './patterns';

/** One chord per bar (G major). */
const CHORDS = ['G', 'Em', 'C', 'D', 'C', 'Am', 'D', 'G'];

const MELODY = [
  'G4 - B4 - D5 - G5 -',
  'F#5 - E5 D5 E5 - - -',
  'C5 - E5 - A5 - G5 F#5',
  'G5 - - - D5 - . .',
  'E5 - D5 C5 B4 - C5 D5',
  'E5 - C5 - A4 - . .',
  'B4 - D5 - G5 - F#5 A5',
  'G5 - - - - - . .',
].join(' | ');

const ARPS: Readonly<Record<string, string>> = {
  G: 'G3 B3 D4 B3 G3 B3 D4 B3',
  Em: 'E3 G3 B3 G3 E3 G3 B3 G3',
  C: 'C4 E4 G3 E4 C4 E4 G3 E4',
  D: 'D4 F#4 A3 F#4 D4 F#4 A3 F#4',
  Am: 'A3 C4 E4 C4 A3 C4 E4 C4',
};

const BASS: Readonly<Record<string, string>> = {
  G: 'G2 - - - D3 - - -',
  Em: 'E2 - - - B2 - - -',
  C: 'C3 - - - G2 - - -',
  D: 'D3 - - - A2 - - -',
  Am: 'A2 - - - E3 - - -',
};

/** Title screen: stately and warm, 112 bpm, 8 bars. */
export const TITLE: Song = {
  bpm: 112,
  stepsPerBeat: 2,
  channels: {
    pulse1: { notes: MELODY, duty: 0.25, volume: 0.3, sustain: 0.7 },
    pulse2: { notes: perChord(CHORDS, ARPS), duty: 0.125, volume: 0.13, sustain: 0.3 },
    wave: { notes: perChord(CHORDS, BASS), volume: 0.5, sustain: 0.6 },
    noise: { notes: repeat('h . . . s . h .', 8) },
  },
};
