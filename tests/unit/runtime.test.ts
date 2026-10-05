// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '../../src/audio/types';
import { DEFAULT_SETTINGS, type HostOptions } from '../../src/engine/api';
import type { SfxId, SongId } from '../../src/game/types';

const presents: { lcd: boolean; palette: readonly string[] }[] = [];
const clears: number[] = [];
vi.mock('../../src/engine/blit', () => ({
  createBlitter: () => ({
    present: (_fb: Uint8Array, palette: readonly string[], lcd: boolean) =>
      presents.push({ lcd, palette }),
    clear: (shade: number) => clears.push(shade),
    resize: () => undefined,
  }),
}));

const { createGameHost, planLevels } = await import('../../src/engine/runtime');
const { LEVELS } = await import('../../src/game/levels');

let frames: (() => void)[] = [];
let clock = 0;

function runFrames(n: number): void {
  for (let i = 0; i < n; i++) {
    clock += 1000 / 60;
    const queue = frames;
    frames = [];
    for (const f of queue) f();
  }
}

function fakeAudio() {
  const log: { sfx: SfxId[]; music: (SongId | null)[]; unlocks: number } = {
    sfx: [],
    music: [],
    unlocks: 0,
  };
  const audio: AudioEngine = {
    unlocked: false,
    unlock: () => {
      log.unlocks++;
      return Promise.resolve();
    },
    playSfx: (id) => log.sfx.push(id),
    playMusic: (s) => log.music.push(s),
    setVolume: () => undefined,
    setMuted: () => undefined,
    dispose: () => undefined,
  };
  return { audio, log };
}

const opts = (extra: Partial<HostOptions> = {}): HostOptions => ({
  test: true,
  levelOverride: null,
  seed: 1,
  reducedMotion: false,
  storage: null,
  ...extra,
});

const press = (key: string, type: 'keydown' | 'keyup' = 'keydown'): void => {
  window.dispatchEvent(new KeyboardEvent(type, { key }));
};

beforeEach(() => {
  frames = [];
  presents.length = 0;
  clears.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('game host runtime', () => {
  it('plans levels from the override', () => {
    expect(planLevels(null, false).startScene).toBe('boot');
    expect(planLevels(LEVELS[0]!.id, false)).toMatchObject({
      startIndex: 0,
      startScene: 'playing',
    });
    expect(planLevels('nope', true).startScene).toBe('boot');
  });

  it('boots, renders, marks the canvas ready, skips boot on Enter and exposes __GAME__', () => {
    const { audio } = fakeAudio();
    const host = createGameHost(opts(), audio);
    const canvas = document.createElement('canvas');
    const seen: string[] = [];
    host.subscribe(() => seen.push(host.getSnapshot().scene));
    host.attachCanvas(canvas);
    runFrames(3);
    expect(canvas.dataset.ready).toBe('1');
    expect(presents.every((p) => !p.lcd)).toBe(true);
    expect(window.__GAME__?.scene).toBe('boot');
    expect(window.__GAME__?.tick).toBeGreaterThan(0);
    press('Enter');
    runFrames(1);
    press('Enter', 'keyup');
    expect(host.getSnapshot().scene).toBe('title');
    const snap = host.getSnapshot();
    runFrames(5);
    expect(host.getSnapshot()).toBe(snap);
    expect(seen).toEqual(['title']);
    host.destroy();
    expect(window.__GAME__).toBeUndefined();
  });

  it('pauses on blur, routes events to audio and persists the high score', () => {
    const { audio, log } = fakeAudio();
    const store = new Map<string, string>([['pocketleaf.highscore', '1234']]);
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const host = createGameHost(opts({ levelOverride: LEVELS[0]!.id, storage }), audio);
    host.attachCanvas(document.createElement('canvas'));
    expect(log.music).toEqual([LEVELS[0]!.song]);
    runFrames(2);
    expect(host.getSnapshot().scene).toBe('playing');
    window.dispatchEvent(new Event('blur'));
    expect(host.getSnapshot().scene).toBe('paused');
    expect(log.sfx).toContain('pause');
    const tick = window.__GAME__!.tick;
    const n = presents.length;
    runFrames(10);
    expect(window.__GAME__!.tick).toBe(tick);
    // One redraw shows the pause screen, then rendering idles.
    expect(presents.length).toBe(n + 1);
    host.unlockAudio();
    expect(log.unlocks).toBe(1);
    host.destroy();
  });

  it('powers off to a flat shade and back on at boot; settings apply', () => {
    const { audio } = fakeAudio();
    const host = createGameHost(opts({ test: false }), audio);
    host.attachCanvas(document.createElement('canvas'));
    host.setSettings({ ...DEFAULT_SETTINGS, palette: 'grey', lcd: true });
    runFrames(2);
    expect(presents.at(-1)).toMatchObject({ lcd: true });
    host.setPowered(false);
    expect(host.getSnapshot().powered).toBe(false);
    expect(clears).toEqual([1]);
    runFrames(5);
    host.setPowered(true);
    expect(host.getSnapshot()).toMatchObject({ powered: true, scene: 'boot' });
    host.destroy();
  });

  it('shows a toast when a controller connects via an event-only pad', () => {
    const { audio } = fakeAudio();
    const host = createGameHost(opts(), audio);
    host.attachCanvas(document.createElement('canvas'));
    const pad = { index: 0, connected: true, buttons: [{ pressed: true }], axes: [0, 0] };
    window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
    runFrames(1);
    expect(host.getSnapshot().toast).toBe('Controller connected');
    clock += 2500;
    runFrames(1);
    expect(host.getSnapshot().toast).toBeNull();
    window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad }));
    runFrames(1);
    expect(host.getSnapshot().toast).toBe('Controller disconnected');
    host.destroy();
  });
  it('a blur during the intro card pauses as soon as play begins', () => {
    const { audio } = fakeAudio();
    const host = createGameHost(opts(), audio);
    host.attachCanvas(document.createElement('canvas'));
    runFrames(2);
    press('Enter');
    runFrames(1);
    press('Enter', 'keyup');
    runFrames(2);
    press('Enter');
    runFrames(1);
    press('Enter', 'keyup');
    expect(host.getSnapshot().scene).toBe('intro');
    window.dispatchEvent(new Event('blur'));
    expect(host.getSnapshot().scene).toBe('intro');
    runFrames(400);
    expect(host.getSnapshot().scene).toBe('paused');
    host.destroy();
  });

  it('powering off mid-game still saves a new high score', () => {
    const { audio } = fakeAudio();
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const host = createGameHost(opts({ levelOverride: 'test-coins', storage }), audio);
    host.attachCanvas(document.createElement('canvas'));
    press('ArrowRight');
    runFrames(120);
    press('ArrowRight', 'keyup');
    expect(window.__GAME__!.score).toBeGreaterThan(0);
    const score = window.__GAME__!.score;
    host.setPowered(false);
    expect(store.get('pocketleaf.highscore')).toBe(String(score));
    host.destroy();
  });
});
