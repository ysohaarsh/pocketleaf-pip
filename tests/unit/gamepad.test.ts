import { describe, expect, it } from 'vitest';
import { InputHub } from '../../src/input/InputState';
import { createGamepadPoller, readPad, type PadLike } from '../../src/input/gamepad';

function pad(index: number, down: number[] = [], axes: number[] = [0, 0]): PadLike {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) }));
  return { index, connected: true, buttons, axes };
}

describe('gamepad mapping', () => {
  it('reads the standard mapping', () => {
    expect(readPad(pad(0, [0]))).toMatchObject({ a: true, b: false });
    expect(readPad(pad(0, [1])).b).toBe(true);
    expect(readPad(pad(0, [2])).b).toBe(true);
    expect(readPad(pad(0, [8])).select).toBe(true);
    expect(readPad(pad(0, [9])).start).toBe(true);
    expect(readPad(pad(0, [12, 13, 14, 15]))).toMatchObject({
      up: true,
      down: true,
      left: true,
      right: true,
    });
  });

  it('applies the 0.3 stick deadzone', () => {
    expect(readPad(pad(0, [], [0.29, -0.29]))).toMatchObject({
      left: false,
      right: false,
      up: false,
    });
    expect(readPad(pad(0, [], [0.5, -0.5]))).toMatchObject({ right: true, up: true });
    expect(readPad(pad(0, [], [-0.5, 0.5]))).toMatchObject({ left: true, down: true });
    expect(readPad({ index: 0, connected: true, buttons: [], axes: [] }).a).toBe(false);
  });

  it('merges pads, reports new presses and connect/disconnect transitions', () => {
    const hub = new InputHub();
    let pads: (PadLike | null)[] = [];
    const log: string[] = [];
    const poller = createGamepadPoller(hub, () => pads, {
      onConnect: () => log.push('connect'),
      onDisconnect: () => log.push('disconnect'),
    });
    expect(poller.poll()).toBe(false);
    pads = [pad(0, [0]), null, pad(2, [], [1, 0])];
    expect(poller.poll()).toBe(true);
    expect(log).toEqual(['connect']);
    expect(poller.connectedCount()).toBe(2);
    expect(hub.getHeld()).toMatchObject({ a: true, right: true });
    // Held, not newly pressed.
    expect(poller.poll()).toBe(false);
    pads = [pad(0, [9])];
    expect(poller.poll()).toBe(true);
    expect(log).toEqual(['connect', 'disconnect']);
    expect(hub.getHeld()).toMatchObject({ a: false, start: true, right: false });
    pads = [{ ...pad(0, [9]), connected: false }];
    poller.poll();
    expect(log).toEqual(['connect', 'disconnect', 'disconnect']);
    expect(hub.getHeld().start).toBe(false);
    expect(poller.connectedCount()).toBe(0);
  });

  it('survives a throwing getGamepads', () => {
    const hub = new InputHub();
    const poller = createGamepadPoller(hub, () => {
      throw new Error('blocked');
    });
    expect(poller.poll()).toBe(false);
  });

  it('defaults to navigator.getGamepads when present', () => {
    const hub = new InputHub();
    const nav = globalThis.navigator as Navigator & { getGamepads?: () => (PadLike | null)[] };
    const original = nav.getGamepads;
    Object.defineProperty(nav, 'getGamepads', { value: () => [pad(0, [0])], configurable: true });
    try {
      expect(createGamepadPoller(hub).poll()).toBe(true);
    } finally {
      Object.defineProperty(nav, 'getGamepads', { value: original, configurable: true });
    }
  });
});
