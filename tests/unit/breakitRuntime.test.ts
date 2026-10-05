// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '../../src/audio/types';
import type { HostOptions } from '../../src/engine/api';

vi.mock('../../src/engine/blit', () => ({
  createBlitter: () => ({
    present: () => undefined,
    clear: () => undefined,
    resize: () => undefined,
  }),
}));

const { createGameHost } = await import('../../src/engine/runtime');

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

const audio: AudioEngine = {
  unlocked: true,
  unlock: () => Promise.resolve(),
  playSfx: () => undefined,
  playMusic: () => undefined,
  setVolume: () => undefined,
  setMuted: () => undefined,
  dispose: () => undefined,
};

const opts = (extra: Partial<HostOptions> = {}): HostOptions => ({
  test: true,
  levelOverride: null,
  seed: 1,
  reducedMotion: false,
  storage: null,
  ...extra,
});

const key = (k: string, type: 'keydown' | 'keyup' = 'keydown'): void => {
  window.dispatchEvent(new KeyboardEvent(type, { key: k }));
};

const scene = (): string | undefined => window.__GAME__?.scene;

beforeEach(() => {
  frames = [];
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

/** Walk Pip into the Mossbug of test-enemies until he dies. */
function walkIntoEnemy(): void {
  key('ArrowRight');
  for (let i = 0; i < 600 && scene() !== 'dying'; i++) runFrames(1);
  key('ArrowRight', 'keyup');
  expect(scene()).toBe('dying');
}

describe('break-it: host focus and power edge cases', () => {
  it('a blur while dying pauses as soon as the retry begins (never plays unattended)', () => {
    const host = createGameHost(opts({ levelOverride: 'test-enemies' }), audio);
    host.attachCanvas(document.createElement('canvas'));
    runFrames(2);
    walkIntoEnemy();
    window.dispatchEvent(new Event('blur'));
    runFrames(600);
    expect(scene()).toBe('paused');
    host.destroy();
  });

  it('opening settings while dying also pauses once play resumes', () => {
    const host = createGameHost(opts({ levelOverride: 'test-enemies' }), audio);
    host.attachCanvas(document.createElement('canvas'));
    runFrames(2);
    walkIntoEnemy();
    host.requestPause();
    runFrames(600);
    expect(scene()).toBe('paused');
    host.destroy();
  });

  it('a blur on the title does not pause a game started later', () => {
    const host = createGameHost(opts(), audio);
    host.attachCanvas(document.createElement('canvas'));
    runFrames(2);
    key('Enter');
    runFrames(1);
    key('Enter', 'keyup');
    expect(scene()).toBe('title');
    window.dispatchEvent(new Event('blur'));
    runFrames(5);
    key('Enter');
    runFrames(1);
    key('Enter', 'keyup');
    runFrames(400);
    expect(scene()).toBe('playing');
    host.destroy();
  });

  it('buttons pressed while powered off do not skip the boot screen on power-on', () => {
    const host = createGameHost(opts(), audio);
    host.attachCanvas(document.createElement('canvas'));
    runFrames(2);
    host.setPowered(false);
    key('Enter');
    key('Enter', 'keyup');
    host.setPowered(true);
    runFrames(2);
    expect(scene()).toBe('boot');
    host.destroy();
  });
});
