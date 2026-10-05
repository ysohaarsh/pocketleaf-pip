import { useEffect, useId, useRef, type RefObject } from 'react';
import type { PaletteId, Settings } from '../engine/api';

interface SettingsPanelProps {
  settings: Settings;
  onChange(next: Settings): void;
  onClose(): void;
  /** The toggle button; clicks on it are not "outside" clicks and focus returns to it. */
  anchorRef: RefObject<HTMLButtonElement | null>;
}

const PALETTE_OPTIONS: { id: PaletteId; label: string }[] = [
  { id: 'classic', label: 'Classic Green' },
  { id: 'grey', label: 'Pocket Grey' },
];

/** Non-modal settings popover. Game keys are ignored inside it (`data-no-game-keys`). */
export function SettingsPanel({ settings, onChange, onClose, anchorRef }: SettingsPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const ids = { volume: useId(), muted: useId(), lcd: useId(), palette: useId() };

  useEffect(() => {
    firstRef.current?.focus();
    const anchor = anchorRef.current;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        anchor?.focus();
      }
    };
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node | null;
      if (!target || rootRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [onClose, anchorRef]);

  return (
    <div
      ref={rootRef}
      id="settings-panel"
      data-testid="settings-panel"
      className="settings"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-no-game-keys=""
    >
      <h2 id={titleId} className="settings__title">
        Settings
      </h2>

      <div className="settings__row settings__row--stack">
        <label htmlFor={ids.volume}>
          Volume <output htmlFor={ids.volume}>{Math.round(settings.volume * 100)}</output>
        </label>
        <input
          ref={firstRef}
          id={ids.volume}
          data-testid="settings-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) / 100 })}
        />
      </div>

      <div className="settings__row">
        <label htmlFor={ids.muted}>Mute</label>
        <input
          id={ids.muted}
          data-testid="settings-mute"
          type="checkbox"
          role="switch"
          checked={settings.muted}
          onChange={(e) => onChange({ ...settings, muted: e.target.checked })}
        />
      </div>

      <div className="settings__row">
        <label htmlFor={ids.lcd}>LCD effects</label>
        <input
          id={ids.lcd}
          data-testid="settings-lcd"
          type="checkbox"
          role="switch"
          checked={settings.lcd}
          onChange={(e) => onChange({ ...settings, lcd: e.target.checked })}
        />
      </div>

      <div className="settings__row">
        <label htmlFor={ids.palette}>Palette</label>
        <select
          id={ids.palette}
          data-testid="settings-palette"
          value={settings.palette}
          onChange={(e) => {
            const found = PALETTE_OPTIONS.find((p) => p.id === e.target.value);
            if (found) onChange({ ...settings, palette: found.id });
          }}
        >
          {PALETTE_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="settings__done"
        onClick={() => {
          onClose();
          anchorRef.current?.focus();
        }}
      >
        Done
      </button>
    </div>
  );
}
