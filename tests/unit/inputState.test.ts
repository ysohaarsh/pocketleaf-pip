import { describe, expect, it } from 'vitest';
import { InputHub, emptyButtons, makeFrame } from '../../src/input/InputState';

describe('InputHub', () => {
  it('merges sources and reports edges once per sample', () => {
    const hub = new InputHub();
    hub.setButton('kbd', 'a', true);
    hub.setButton('pad', 'left', true);
    const f1 = hub.sample();
    expect(f1.held.a && f1.held.left).toBe(true);
    expect(f1.pressed.a).toBe(true);
    const f2 = hub.sample();
    expect(f2.pressed.a).toBe(false);
    hub.setButton('kbd', 'a', false);
    expect(hub.sample().released.a).toBe(true);
  });

  it('latches sub-tick taps', () => {
    const hub = new InputHub();
    hub.setButton('touch', 'start', true);
    hub.setButton('touch', 'start', false);
    const f = hub.sample();
    expect(f.held.start).toBe(false);
    expect(f.pressed.start).toBe(true);
  });

  it('keeps held identity stable when nothing changes', () => {
    const hub = new InputHub();
    const before = hub.getHeld();
    hub.setButton('kbd', 'b', false);
    expect(hub.getHeld()).toBe(before);
  });

  it('makeFrame computes pressed and released', () => {
    const prev = { ...emptyButtons(), up: true };
    const held = { ...emptyButtons(), down: true };
    const f = makeFrame(prev, held);
    expect(f.pressed.down).toBe(true);
    expect(f.released.up).toBe(true);
  });
});
