import { describe, expect, it, vi } from 'vitest';
import { InputHub } from '../../src/input/InputState';
import {
  attachButtons,
  attachDpad,
  dpadDirections,
  hitButton,
  type PointerLike,
  type PointerSurface,
  type Rect,
} from '../../src/input/touch';

type Listener = (e: PointerLike) => void;

class FakeSurface implements PointerSurface {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly captured: number[] = [];
  constructor(public rect: Rect) {}
  addEventListener(type: string, l: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(l);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, l: Listener): void {
    this.listeners.get(type)?.delete(l);
  }
  getBoundingClientRect(): Rect {
    return this.rect;
  }
  setPointerCapture(id: number): void {
    this.captured.push(id);
  }
  listenerCount(): number {
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
  fire(type: string, pointerId: number, x: number, y: number, extra: Partial<PointerLike> = {}) {
    const e = {
      pointerId,
      pointerType: 'touch',
      button: 0,
      clientX: x,
      clientY: y,
      preventDefault: vi.fn(),
      ...extra,
    };
    for (const l of this.listeners.get(type) ?? []) l(e);
    return e;
  }
}

// D-pad occupies 0..90 on both axes, centre (45, 45), half-size 45.
const PAD: Rect = { left: 0, top: 0, width: 90, height: 90 };

describe('dpadDirections', () => {
  it('returns nothing inside the centre deadzone', () => {
    expect(dpadDirections(PAD, 45, 45)).toEqual({});
    expect(dpadDirections(PAD, 50, 48)).toEqual({});
  });

  it('picks the dominant axis on the arms', () => {
    expect(dpadDirections(PAD, 45, 5)).toEqual({ up: true });
    expect(dpadDirections(PAD, 45, 85)).toEqual({ down: true });
    expect(dpadDirections(PAD, 5, 45)).toEqual({ left: true });
    expect(dpadDirections(PAD, 85, 50)).toEqual({ right: true });
  });

  it('yields diagonals in the corner zones', () => {
    expect(dpadDirections(PAD, 85, 5)).toEqual({ up: true, right: true });
    expect(dpadDirections(PAD, 5, 85)).toEqual({ down: true, left: true });
  });

  it('keeps tracking outside the box (captured pointer)', () => {
    expect(dpadDirections(PAD, 45, -40)).toEqual({ up: true });
  });

  it('handles a zero-size box', () => {
    expect(dpadDirections({ left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toEqual({});
  });
});

describe('attachDpad', () => {
  it('maps a pointer to its own source and follows slides between arms', () => {
    const hub = new InputHub();
    const el = new FakeSurface(PAD);
    const vibrate = vi.fn();
    attachDpad(el, hub, { vibrate });

    const down = el.fire('pointerdown', 1, 45, 5);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(el.captured).toEqual([1]);
    expect(hub.getHeld().up).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);

    el.fire('pointermove', 1, 85, 45);
    expect(hub.getHeld()).toMatchObject({ up: false, right: true });
    expect(vibrate).toHaveBeenCalledTimes(2);

    el.fire('pointermove', 1, 45, 45);
    expect(hub.getHeld()).toMatchObject({ up: false, down: false, left: false, right: false });

    el.fire('pointermove', 1, 5, 45);
    el.fire('pointerup', 1, 5, 45);
    expect(hub.getHeld().left).toBe(false);
  });

  it('ignores moves from pointers that never pressed it and non-primary mouse buttons', () => {
    const hub = new InputHub();
    const el = new FakeSurface(PAD);
    attachDpad(el, hub, { vibrate: () => undefined });
    el.fire('pointermove', 7, 45, 5);
    expect(hub.getHeld().up).toBe(false);
    el.fire('pointerdown', 8, 45, 5, { pointerType: 'mouse', button: 2 });
    expect(hub.getHeld().up).toBe(false);
  });

  it('releases on pointercancel and lostpointercapture', () => {
    const hub = new InputHub();
    const el = new FakeSurface(PAD);
    attachDpad(el, hub, { vibrate: () => undefined });
    el.fire('pointerdown', 1, 45, 5);
    el.fire('pointercancel', 1, 45, 5);
    expect(hub.getHeld().up).toBe(false);
    el.fire('pointerdown', 2, 45, 85);
    el.fire('lostpointercapture', 2, 0, 0);
    expect(hub.getHeld().down).toBe(false);
  });

  it('cleanup removes listeners and releases held pointers', () => {
    const hub = new InputHub();
    const el = new FakeSurface(PAD);
    const detach = attachDpad(el, hub, { vibrate: () => undefined });
    el.fire('pointerdown', 1, 45, 5);
    detach();
    expect(hub.getHeld().up).toBe(false);
    expect(el.listenerCount()).toBe(0);
  });
});

describe('attachButtons', () => {
  const setup = () => {
    const hub = new InputHub();
    const b = new FakeSurface({ left: 0, top: 50, width: 40, height: 40 });
    const a = new FakeSurface({ left: 60, top: 20, width: 40, height: 40 });
    const vibrate = vi.fn();
    const detach = attachButtons(
      [
        { el: b, name: 'b' },
        { el: a, name: 'a' },
      ],
      hub,
      { vibrate },
    );
    return { hub, a, b, vibrate, detach };
  };

  it('hit-tests against the group', () => {
    const { a, b } = setup();
    const targets = [
      { el: b, name: 'b' as const },
      { el: a, name: 'a' as const },
    ];
    expect(hitButton(targets, 20, 70)).toBe('b');
    expect(hitButton(targets, 80, 40)).toBe('a');
    expect(hitButton(targets, 50, 10)).toBeNull();
  });

  it('slides from B to A, releases off-target, and re-presses on return', () => {
    const { hub, b, vibrate } = setup();
    b.fire('pointerdown', 3, 20, 70);
    expect(hub.getHeld()).toMatchObject({ a: false, b: true });
    // Captured pointer: moves keep arriving at the original surface.
    b.fire('pointermove', 3, 80, 40);
    expect(hub.getHeld()).toMatchObject({ a: true, b: false });
    b.fire('pointermove', 3, 50, 0);
    expect(hub.getHeld()).toMatchObject({ a: false, b: false });
    b.fire('pointermove', 3, 20, 70);
    expect(hub.getHeld().b).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(3);
    b.fire('pointerup', 3, 20, 70);
    expect(hub.getHeld().b).toBe(false);
  });

  it('merges simultaneous pointers as separate sources', () => {
    const { hub, a, b } = setup();
    b.fire('pointerdown', 1, 20, 70);
    a.fire('pointerdown', 2, 80, 40);
    expect(hub.getHeld()).toMatchObject({ a: true, b: true });
    b.fire('pointerup', 1, 20, 70);
    expect(hub.getHeld()).toMatchObject({ a: true, b: false });
    a.fire('pointerup', 2, 80, 40);
    expect(hub.getHeld().a).toBe(false);
  });

  it('works alongside a D-pad pointer on the same hub', () => {
    const { hub, a } = setup();
    const pad = new FakeSurface(PAD);
    attachDpad(pad, hub, { vibrate: () => undefined });
    pad.fire('pointerdown', 10, 85, 45);
    a.fire('pointerdown', 11, 80, 40);
    expect(hub.getHeld()).toMatchObject({ right: true, a: true });
    pad.fire('pointerup', 10, 85, 45);
    expect(hub.getHeld()).toMatchObject({ right: false, a: true });
  });

  it('does not vibrate when the default haptics are unavailable', () => {
    const hub = new InputHub();
    const el = new FakeSurface({ left: 0, top: 0, width: 10, height: 10 });
    attachButtons([{ el, name: 'start' }], hub);
    expect(() => el.fire('pointerdown', 1, 5, 5)).not.toThrow();
    expect(hub.getHeld().start).toBe(true);
  });
});
