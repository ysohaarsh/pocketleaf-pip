import { useCallback, useRef, useState } from 'react';
import type { GameHost, Settings } from '../engine/api';
import { ActionButtons } from './ActionButtons';
import { Dpad } from './Dpad';
import { MetaButtons } from './MetaButtons';
import { PowerSwitch } from './PowerSwitch';
import { Screen } from './Screen';
import { SettingsPanel } from './Settings';
import { Toast } from './Toast';
import { Toolbar } from './Toolbar';
import { useHostSnapshot } from './useGameHost';

interface ConsoleProps {
  host: GameHost;
  settings: Settings;
  onSettingsChange(next: Settings): void;
  /** CSS LCD overlay enabled (settings.lcd, forced off in test mode). */
  lcdOverlay: boolean;
}

/** Desktop keyboard legend under the console; mirrors BY_CODE in src/input/keyboard.ts. */
const HINTS: readonly { keys: readonly string[]; action: string }[] = [
  { keys: ['←', '↑', '→', '↓'], action: 'Move' },
  { keys: ['Z'], action: 'Jump (A)' },
  { keys: ['X'], action: 'Run (B)' },
  { keys: ['Enter'], action: 'Start / Pause' },
  { keys: ['Shift'], action: 'Select · Music' },
];

/** The POCKETLEAF handheld body. Renders only on low-frequency host/input changes. */
export function Console({ host, settings, onSettingsChange, lcdOverlay }: ConsoleProps) {
  const snapshot = useHostSnapshot(host);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const toggleSettings = (): void => {
    if (!settingsOpen) host.requestPause();
    setSettingsOpen(!settingsOpen);
  };

  return (
    <>
      <Toast message={snapshot.toast} />
      <main
        className="console"
        data-testid="console"
        aria-label="POCKETLEAF handheld"
        data-powered={snapshot.powered ? 'on' : 'off'}
      >
        <div className="console__body">
          <div className="console__top">
            <div className="console__status">
              <PowerSwitch
                powered={snapshot.powered}
                onToggle={() => host.setPowered(!snapshot.powered)}
              />
              <span className="pwr" aria-hidden="true">
                <span className="led" data-on={snapshot.powered ? 'true' : 'false'} />
                <span className="pwr__label">PWR</span>
              </span>
            </div>
            <Toolbar
              settingsOpen={settingsOpen}
              onToggleSettings={toggleSettings}
              settingsButtonRef={settingsButtonRef}
            />
          </div>

          <section className="bezel" aria-label="Screen">
            <Screen host={host} powered={snapshot.powered} lcd={lcdOverlay} />
            <span className="bezel__caption" aria-hidden="true">
              4-SHADE · 160×144
            </span>
          </section>

          <p className="brand" aria-hidden="true">
            <span className="brand__pocket">pocket</span>
            <span className="brand__leafword">leaf</span>
            <svg className="brand__leaf" viewBox="0 0 20 20" focusable="false">
              <path d="M3 17C3 9 8 3 18 2c-1 9-6 15-15 15z" />
              <path className="brand__vein" d="M4 16C8 11 11 8 15 5" />
            </svg>
          </p>

          <Dpad input={host.input} />
          <ActionButtons input={host.input} />
          <MetaButtons input={host.input} />

          <div className="speaker" aria-hidden="true" />

          {settingsOpen && (
            <SettingsPanel
              settings={settings}
              onChange={onSettingsChange}
              onClose={closeSettings}
              anchorRef={settingsButtonRef}
            />
          )}
        </div>
      </main>
      <ul className="hint" aria-label="Keyboard controls">
        {HINTS.map(({ keys, action }) => (
          <li key={action} className="hint__item">
            <span className="hint__keys">
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span className="hint__action">{action}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
