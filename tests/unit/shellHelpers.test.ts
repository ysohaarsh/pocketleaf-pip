import { describe, expect, it, vi } from 'vitest';
import type { GameHost } from '../../src/engine/api';
import { createHostStore } from '../../src/shell/hostStore';
import { lcdOverlayVars } from '../../src/shell/screenScale';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../../src/shell/fullscreen';

describe('lcdOverlayVars', () => {
  it('derives CSS px per game pixel from the canvas width', () => {
    expect(lcdOverlayVars(320)).toEqual({ scale: 2, grid: true });
    expect(lcdOverlayVars(480)).toEqual({ scale: 3, grid: true });
    expect(lcdOverlayVars(400)).toEqual({ scale: 2.5, grid: true });
  });

  it('disables the grid at 1x and for an unlaid-out canvas', () => {
    expect(lcdOverlayVars(160)).toEqual({ scale: 1, grid: false });
    expect(lcdOverlayVars(0)).toEqual({ scale: 0, grid: false });
  });
});

describe('createHostStore', () => {
  const fakeHost = (n: number) => ({ id: n }) as unknown as GameHost;

  it('creates lazily, shares between holders and disposes after the last release', () => {
    let made = 0;
    const dispose = vi.fn();
    const store = createHostStore(() => ({ host: fakeHost(++made), dispose }));
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot()).toBeNull();
    expect(made).toBe(0);

    const r1 = store.acquire();
    const r2 = store.acquire();
    expect(made).toBe(1);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    r1();
    r1();
    expect(dispose).not.toHaveBeenCalled();
    r2();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('survives a StrictMode-style mount → unmount → mount with a fresh host', () => {
    const disposed: number[] = [];
    let made = 0;
    const store = createHostStore(() => {
      const id = ++made;
      return { host: fakeHost(id), dispose: () => disposed.push(id) };
    });
    store.acquire()();
    const release = store.acquire();
    expect(disposed).toEqual([1]);
    expect(store.getSnapshot()).toEqual({ id: 2 });
    release();
    expect(disposed).toEqual([1, 2]);
  });
});

describe('fullscreen helpers', () => {
  const doc = (extra: object) => ({
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    ...extra,
  });

  it('detects standard and webkit support', () => {
    expect(fullscreenSupported(doc({ fullscreenEnabled: true }))).toBe(true);
    expect(fullscreenSupported(doc({ webkitFullscreenEnabled: true }))).toBe(true);
    expect(fullscreenSupported(doc({}))).toBe(false);
  });

  it('enters with the webkit fallback and exits with the standard API', () => {
    const webkitRequestFullscreen = vi.fn();
    toggleFullscreen(doc({ fullscreenElement: null }), { webkitRequestFullscreen });
    expect(webkitRequestFullscreen).toHaveBeenCalledOnce();

    const exitFullscreen = vi.fn(() => Promise.resolve());
    const d = doc({ fullscreenElement: {} as Element, exitFullscreen });
    expect(isFullscreen(d)).toBe(true);
    toggleFullscreen(d, {});
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
