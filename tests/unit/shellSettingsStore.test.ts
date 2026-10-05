import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/engine/api';
import {
  SETTINGS_KEY,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from '../../src/shell/settingsStore';

class FakeStorage {
  readonly data = new Map<string, string>();
  failGet = false;
  failSet = false;
  getItem(key: string): string | null {
    if (this.failGet) throw new Error('denied');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error('quota');
    this.data.set(key, value);
  }
}

describe('settingsStore', () => {
  it('uses the versioned key', () => {
    expect(SETTINGS_KEY).toBe('pocketleaf.settings.v1');
  });

  it('returns defaults with no storage, no entry, bad JSON or a throwing storage', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = new FakeStorage();
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    s.data.set(SETTINGS_KEY, '{not json');
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    s.failGet = true;
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a copy, never the shared defaults object', () => {
    expect(loadSettings(null)).not.toBe(DEFAULT_SETTINGS);
  });

  it('round-trips valid settings', () => {
    const s = new FakeStorage();
    const next = { volume: 0.25, muted: true, lcd: false, palette: 'grey' as const };
    saveSettings(s, next);
    expect(JSON.parse(s.data.get(SETTINGS_KEY) ?? '')).toEqual(next);
    expect(loadSettings(s)).toEqual(next);
  });

  it('validates field by field', () => {
    expect(
      sanitizeSettings({ volume: 7, muted: 'yes', lcd: false, palette: 'neon', extra: 1 }),
    ).toEqual({ ...DEFAULT_SETTINGS, volume: 1, lcd: false });
    expect(sanitizeSettings({ volume: -2 }).volume).toBe(0);
    expect(sanitizeSettings({ volume: Number.NaN }).volume).toBe(DEFAULT_SETTINGS.volume);
    expect(sanitizeSettings({ palette: 'toString' }).palette).toBe(DEFAULT_SETTINGS.palette);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores storage write failures', () => {
    const s = new FakeStorage();
    s.failSet = true;
    expect(() => saveSettings(s, DEFAULT_SETTINGS)).not.toThrow();
    expect(() => saveSettings(null, DEFAULT_SETTINGS)).not.toThrow();
  });
});
