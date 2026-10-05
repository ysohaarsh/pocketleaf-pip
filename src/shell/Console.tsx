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

const SPEAKER_SLOTS = [0, 1, 2, 3, 4, 5];

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
            <PowerSwitch
              powered={snapshot.powered}
              onToggle={() => host.setPowered(!snapshot.powered)}
            />
            <Toolbar
              settingsOpen={settingsOpen}
              onToggleSettings={toggleSettings}
              settingsButtonRef={settingsButtonRef}
            />
          </div>

          <section className="bezel" aria-label="Screen">
            <div className="bezel__header" aria-hidden="true">
              <span className="bezel__rule" />
              <span className="bezel__caption">FOUR-SHADE POCKET LCD</span>
              <span className="bezel__rule" />
            </div>
            <div className="bezel__body">
              <div className="bezel__power" aria-hidden="true">
                <span className="led" data-on={snapshot.powered ? 'true' : 'false'} />
                <span className="bezel__power-label">POWER</span>
              </div>
              <Screen host={host} powered={snapshot.powered} lcd={lcdOverlay} />
            </div>
          </section>

          <p className="brand" aria-hidden="true">
            <span className="brand__word">POCKETLEAF</span>
            <svg className="brand__leaf" viewBox="0 0 20 20" focusable="false">
              <path d="M3 17C3 9 8 3 18 2c-1 9-6 15-15 15z" />
              <path className="brand__vein" d="M4 16C8 11 11 8 15 5" />
            </svg>
          </p>

          <Dpad input={host.input} />
          <ActionButtons input={host.input} />
          <MetaButtons input={host.input} />

          <div className="speaker" aria-hidden="true">
            {SPEAKER_SLOTS.map((i) => (
              <span key={i} className="speaker__slot" />
            ))}
          </div>

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
      <p className="hint">
        <kbd>Arrows</kbd>/<kbd>WASD</kbd> move · <kbd>Z</kbd>/<kbd>K</kbd> A · <kbd>X</kbd>/
        <kbd>J</kbd> B · <kbd>Enter</kbd> START · <kbd>Shift</kbd> SELECT
      </p>
    </>
  );
}
