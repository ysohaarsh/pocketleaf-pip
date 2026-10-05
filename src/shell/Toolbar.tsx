import { useSyncExternalStore, type Ref } from 'react';
import {
  fullscreenSupported,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from './fullscreen';

interface ToolbarProps {
  settingsOpen: boolean;
  onToggleSettings(): void;
  settingsButtonRef: Ref<HTMLButtonElement>;
}

const subscribe = (cb: () => void) => subscribeFullscreen(document, cb);
const getFullscreen = () => isFullscreen(document);
const getServerFalse = () => false;

/** Fullscreen and settings toggles, outside the game screen. */
export function Toolbar({ settingsOpen, onToggleSettings, settingsButtonRef }: ToolbarProps) {
  const fullscreen = useSyncExternalStore(subscribe, getFullscreen, getServerFalse);
  const canFullscreen = fullscreenSupported(document);

  return (
    <div className="toolbar">
      {canFullscreen && (
        <button
          type="button"
          className="toolbar__btn"
          data-testid="fullscreen-toggle"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={fullscreen}
          onClick={() => toggleFullscreen(document, document.documentElement)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {fullscreen ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>
      )}
      <button
        ref={settingsButtonRef}
        type="button"
        className="toolbar__btn"
        data-testid="settings-toggle"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        aria-controls="settings-panel"
        onClick={onToggleSettings}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </button>
    </div>
  );
}
