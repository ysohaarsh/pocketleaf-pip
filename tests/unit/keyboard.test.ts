import { describe, expect, it } from 'vitest';
import { InputHub } from '../../src/input/InputState';
import { attachKeyboard, buttonForKey, isFromEditable } from '../../src/input/keyboard';

interface FakeKey {
  key: string;
  code: string;
  repeat?: boolean;
  target?: unknown;
  prevented?: boolean;
}

/** A minimal window stand-in that records listeners. */
function fakeWindow() {
  const listeners = new Map<string, Set<(e: Event) => void>>();
  const target = {
    addEventListener(type: string, l: EventListenerOrEventListenerObject | null) {
      if (typeof l !== 'function') return;
      const set = listeners.get(type) ?? new Set();
      set.add(l as (e: Event) => void);
      listeners.set(type, set);
    },
    removeEventListener(type: string, l: EventListenerOrEventListenerObject | null) {
      listeners.get(type)?.delete(l as (e: Event) => void);
    },
  };
  const fire = (type: string, k: FakeKey): FakeKey => {
    const ev = {
      repeat: false,
      target: null,
      ...k,
      preventDefault() {
        ev.prevented = true;
      },
    };
    for (const l of listeners.get(type) ?? []) l(ev as unknown as Event);
    return ev;
  };
  return { target, fire, count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0) };
}

/** A fake element whose closest() matches according to `inside`. */
const element = (inside: boolean, editable = false) => ({
  isContentEditable: editable,
  closest: (sel: string) => (inside && sel.length > 0 ? {} : null),
});

describe('keyboard mapping', () => {
  it('maps arrows/WASD, Z/K, X/J, Enter, Shift/Backspace by code or key', () => {
    const cases: [string, string, string][] = [
      ['ArrowUp', 'ArrowUp', 'up'],
      ['s', 'KeyS', 'down'],
      ['a', 'KeyA', 'left'],
      ['ArrowRight', '', 'right'],
      ['z', 'KeyZ', 'a'],
      ['k', '', 'a'],
      ['x', 'KeyX', 'b'],
      ['J', '', 'b'],
      ['Enter', 'Enter', 'start'],
      ['Enter', 'NumpadEnter', 'start'],
      ['Shift', 'ShiftLeft', 'select'],
      ['Backspace', '', 'select'],
    ];
    for (const [key, code, button] of cases) expect(buttonForKey({ key, code })).toBe(button);
    expect(buttonForKey({ key: 'q', code: 'KeyQ' })).toBeNull();
  });

  it('presses and releases buttons, preventing default only for game keys', () => {
    const hub = new InputHub();
    const w = fakeWindow();
    attachKeyboard(hub, w.target);
    const down = w.fire('keydown', { key: 'z', code: 'KeyZ' });
    expect(down.prevented).toBe(true);
    expect(hub.getHeld().a).toBe(true);
    expect(w.fire('keydown', { key: 'q', code: 'KeyQ' }).prevented).toBeUndefined();
    w.fire('keyup', { key: 'z', code: 'KeyZ' });
    expect(hub.getHeld().a).toBe(false);
    // Synthetic events with only `key` work too.
    w.fire('keydown', { key: 'Enter', code: '' });
    expect(hub.getHeld().start).toBe(true);
  });

  it('two keys for one button: releasing one keeps it held', () => {
    const hub = new InputHub();
    const w = fakeWindow();
    attachKeyboard(hub, w.target);
    w.fire('keydown', { key: 'z', code: 'KeyZ' });
    w.fire('keydown', { key: 'k', code: 'KeyK' });
    w.fire('keyup', { key: 'z', code: 'KeyZ' });
    expect(hub.getHeld().a).toBe(true);
    w.fire('keyup', { key: 'k', code: 'KeyK' });
    expect(hub.getHeld().a).toBe(false);
  });

  it('ignores key repeat (but still prevents scrolling)', () => {
    const hub = new InputHub();
    const w = fakeWindow();
    attachKeyboard(hub, w.target);
    w.fire('keydown', { key: 'ArrowDown', code: 'ArrowDown' });
    hub.sample();
    w.fire('keyup', { key: 'ArrowDown', code: 'ArrowDown' });
    const rep = w.fire('keydown', { key: 'ArrowDown', code: 'ArrowDown', repeat: true });
    expect(rep.prevented).toBe(true);
    expect(hub.getHeld().down).toBe(false);
  });

  it('leaves keys aimed at form controls and [data-no-game-keys] alone', () => {
    expect(isFromEditable(null)).toBe(false);
    expect(isFromEditable(element(false) as unknown as EventTarget)).toBe(false);
    expect(isFromEditable(element(true) as unknown as EventTarget)).toBe(true);
    expect(isFromEditable(element(false, true) as unknown as EventTarget)).toBe(true);
    const hub = new InputHub();
    const w = fakeWindow();
    attachKeyboard(hub, w.target);
    const ev = w.fire('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', target: element(true) });
    expect(ev.prevented).toBeUndefined();
    expect(hub.getHeld().left).toBe(false);
  });

  it('blur and detach release everything and remove listeners', () => {
    const hub = new InputHub();
    const w = fakeWindow();
    const detach = attachKeyboard(hub, w.target);
    w.fire('keydown', { key: 'x', code: 'KeyX' });
    w.fire('blur', { key: '', code: '' });
    expect(hub.getHeld().b).toBe(false);
    w.fire('keydown', { key: 'x', code: 'KeyX' });
    detach();
    expect(hub.getHeld().b).toBe(false);
    expect(w.count()).toBe(0);
  });
});
