import { DEFAULT_SETTINGS, PALETTES, type PaletteId, type Settings } from '../engine/api';

export const SETTINGS_KEY = 'pocketleaf.settings.v1';

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && Object.hasOwn(PALETTES, value);
}

/** Validate untrusted data field by field, falling back to defaults for anything invalid. */
export function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const volume =
    typeof r.volume === 'number' && Number.isFinite(r.volume)
      ? Math.min(1, Math.max(0, r.volume))
      : DEFAULT_SETTINGS.volume;
  return {
    volume,
    muted: typeof r.muted === 'boolean' ? r.muted : DEFAULT_SETTINGS.muted,
    lcd: typeof r.lcd === 'boolean' ? r.lcd : DEFAULT_SETTINGS.lcd,
    palette: isPaletteId(r.palette) ? r.palette : DEFAULT_SETTINGS.palette,
  };
}

export function loadSettings(storage: SettingsStorage | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist settings; storage failures (quota, private mode) are ignored. */
export function saveSettings(storage: SettingsStorage | null, settings: Settings): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
  } catch {
    // Persisting is best-effort.
  }
}

/** window.localStorage, or null where access throws (sandboxed iframes, disabled storage). */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * What to write to storage for a settings change. `storedLcd` is the LCD value currently on disk;
 * it only follows `next.lcd` when this change actually toggled LCD. That keeps a session-forced
 * value (test mode starts with lcd:false) from leaking into the persisted settings.
 */
export function settingsToPersist(
  prev: Settings,
  next: Settings,
  storedLcd: boolean,
): { toStore: Settings; storedLcd: boolean } {
  const lcd = next.lcd !== prev.lcd ? next.lcd : storedLcd;
  return { toStore: { ...next, lcd }, storedLcd: lcd };
}
