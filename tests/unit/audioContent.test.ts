import { describe, expect, it } from 'vitest';
import type { SfxId, SongId } from '../../src/game/types';
import { CHANNELS } from '../../src/audio/chip';
import { parseTrack } from '../../src/audio/notation';
import { compileSong } from '../../src/audio/scheduler';
import { SFX, sfxChannels, sfxDuration } from '../../src/audio/sfx';
import { SONGS } from '../../src/audio/songs';

const ALL_SFX: Record<SfxId, true> = {
  jump: true,
  coin: true,
  stomp: true,
  bump: true,
  break: true,
  powerup: true,
  sprout: true,
  hurt: true,
  oneup: true,
  pause: true,
  death: true,
  clear: true,
  select: true,
  boot: true,
};
const ALL_SONGS: Record<SongId, true> = {
  title: true,
  grass: true,
  cave: true,
  sky: true,
  ending: true,
};

describe('SFX', () => {
  it('defines every SfxId with sane notes', () => {
    expect(Object.keys(SFX).sort()).toEqual(Object.keys(ALL_SFX).sort());
    for (const [id, def] of Object.entries(SFX)) {
      expect(def.notes.length, id).toBeGreaterThan(0);
      for (const { channel, at, note } of def.notes) {
        expect(CHANNELS).toContain(channel);
        expect(at).toBeGreaterThanOrEqual(0);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.freq).toBeGreaterThan(0);
        expect(note.volume ?? 0.5).toBeLessThanOrEqual(1);
      }
      expect(sfxDuration(def), id).toBeLessThan(3);
    }
  });

  it('has the intended shapes', () => {
    const first = (id: SfxId) => SFX[id].notes[0]!.note;
    expect(first('jump').freqEnd).toBeGreaterThan(first('jump').freq); // rising
    expect(first('hurt').freqEnd).toBeLessThan(first('hurt').freq); // falling
    expect(SFX.coin.notes).toHaveLength(2);
    expect(SFX.oneup.notes).toHaveLength(4);
    expect(SFX.pause.notes).toHaveLength(2);
    expect(sfxChannels(SFX.stomp).sort()).toEqual(['noise', 'wave']);
    const powerup = SFX.powerup.notes.map((n) => n.note.freq);
    expect(powerup).toEqual([...powerup].sort((a, b) => a - b));
    expect(sfxDuration(SFX.death)).toBeGreaterThan(1.2);
    expect(sfxDuration(SFX.death)).toBeLessThan(1.8);
    expect(sfxDuration(SFX.clear)).toBeGreaterThan(2);
    expect(sfxDuration(SFX.clear)).toBeLessThan(3);
    expect(sfxDuration(SFX.select)).toBeLessThan(0.1);
  });
});

describe('songs', () => {
  it('defines every SongId', () => {
    expect(Object.keys(SONGS).sort()).toEqual(Object.keys(ALL_SONGS).sort());
  });

  for (const [id, song] of Object.entries(SONGS)) {
    it(`${id} parses, is 8–32 whole bars and loops`, () => {
      const c = compileSong(song);
      const stepsPerBar = song.stepsPerBeat * (song.beatsPerBar ?? 4);
      expect(c.length % stepsPerBar).toBe(0);
      const bars = c.length / stepsPerBar;
      expect(bars).toBeGreaterThanOrEqual(8);
      expect(bars).toBeLessThanOrEqual(32);
      expect(c.length - c.loopStart).toBeGreaterThan(0);
      for (const track of Object.values(song.channels)) {
        expect(parseTrack(track.notes).notes.length).toBeGreaterThan(0);
      }
      // Notes never ring past the loop end.
      for (const [step, notes] of c.byStep.entries()) {
        for (const n of notes) expect(step + n.steps).toBeLessThanOrEqual(c.length);
      }
      // Pitched notes stay in a playable range.
      for (const notes of c.byStep) {
        for (const n of notes) {
          if (n.pitch.kind === 'tone') {
            expect(n.pitch.midi).toBeGreaterThanOrEqual(36);
            expect(n.pitch.midi).toBeLessThanOrEqual(100);
          }
        }
      }
    });
  }

  it('fits the requested moods', () => {
    expect(SONGS.grass.bpm).toBeGreaterThanOrEqual(130);
    expect(SONGS.cave.channels.wave?.echo).toBeDefined();
    expect(SONGS.sky.stepsPerBeat).toBe(3); // compound (6/8) feel
  });
});
