import { describe, expect, it } from 'vitest';
import { createGamepadPoller, type PadLike } from '../../src/input/gamepad';
import { InputHub } from '../../src/input/InputState';

/** A connected standard pad with the given button indices held. */
const pad = (...held: number[]): PadLike => ({
  index: 0,
  connected: true,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i) })),
  axes: [0, 0],
});

describe('break-it: input hub after a blur', () => {
  it('a pad button held through clearAll() is restored as held, not as a fresh press', () => {
    const hub = new InputHub();
    let pads: PadLike[] = [pad(9, 0)];
    const poller = createGamepadPoller(hub, () => pads);
    poller.poll();
    expect(hub.sample().pressed).toMatchObject({ start: true, a: true });
    expect(hub.sample().pressed.start).toBe(false);

    hub.clearAll(); // window blur
    poller.poll(); // next frame re-asserts the still-held pad buttons
    const frame = hub.sample();
    expect(frame.held).toMatchObject({ start: true, a: true });
    expect(frame.pressed).toMatchObject({ start: false, a: false });

    // A real release and re-press afterwards still counts.
    pads = [pad()];
    poller.poll();
    hub.sample();
    pads = [pad(9)];
    poller.poll();
    expect(hub.sample().pressed.start).toBe(true);
  });

  it('a sub-tick tap is still latched when nothing was cleared', () => {
    const hub = new InputHub();
    hub.setButton('k', 'a', true);
    hub.sample();
    hub.setButton('k', 'a', false);
    hub.setButton('k', 'a', true);
    expect(hub.sample().pressed.a).toBe(true);
  });
});
