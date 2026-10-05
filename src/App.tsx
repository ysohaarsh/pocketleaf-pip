import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createAudioEngine } from './audio';
import type { Settings } from './engine/api';
import { createGameHost } from './engine/runtime';
import { Console } from './shell/Console';
import { createHostStore } from './shell/hostStore';
import { loadSettings, safeLocalStorage, saveSettings } from './shell/settingsStore';
import { parseUrlParams, type UrlParams } from './shell/urlParams';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function createStore(params: UrlParams, storage: Storage | null) {
  return createHostStore(() => {
    const audio = createAudioEngine();
    const host = createGameHost(
      {
        test: params.test,
        levelOverride: params.levelOverride,
        seed: params.seed,
        reducedMotion: prefersReducedMotion(),
        storage,
      },
      audio,
    );
    return {
      host,
      dispose: () => {
        host.destroy();
        audio.dispose();
      },
    };
  });
}

export function App() {
  const [params] = useState(() =>
    parseUrlParams(window.location.search, () => Math.floor(Math.random() * 0x100000000)),
  );
  const [storage] = useState(safeLocalStorage);
  const [store] = useState(() => createStore(params, storage));
  // Test mode starts with LCD effects off (deterministic pixels) but still honours the toggle.
  const [settings, setSettings] = useState<Settings>(() => {
    const loaded = loadSettings(storage);
    return params.test ? { ...loaded, lcd: false } : loaded;
  });
  const host = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Layout effect so the host exists before first paint (no empty-frame flash / layout shift).
  useLayoutEffect(() => store.acquire(), [store]);

  // Applies persisted settings at startup and every change afterwards (also to a recreated host).
  useEffect(() => {
    host?.setSettings(settings);
  }, [host, settings]);

  useEffect(() => {
    if (!host) return;
    // Kept for the app lifetime: unlockAudio() is idempotent and cheap, and re-running it on each
    // gesture resumes a context that a failed first unlock or an OS interruption left suspended.
    const unlock = (): void => host.unlockAudio();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    const onHidden = (): void => {
      if (document.visibilityState === 'hidden') host.requestPause();
    };
    const onBlur = (): void => host.requestPause();
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [host]);

  const changeSettings = (next: Settings): void => {
    setSettings(next);
    saveSettings(storage, next);
  };

  return (
    <div className="app">
      {host && (
        <Console
          host={host}
          settings={settings}
          onSettingsChange={changeSettings}
          lcdOverlay={settings.lcd}
        />
      )}
    </div>
  );
}
