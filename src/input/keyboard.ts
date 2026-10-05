import type { ButtonName } from '../game/types';
import type { InputHub } from './InputState';

/** Source id the keyboard writes into the InputHub. */
export const KEYBOARD_SOURCE = 'keyboard';

/** KeyboardEvent.code → button. */
const BY_CODE: Readonly<Record<string, ButtonName>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'a',
  KeyK: 'a',
  KeyX: 'b',
  KeyJ: 'b',
  Enter: 'start',
  NumpadEnter: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
  Backspace: 'select',
};

/** KeyboardEvent.key (lower-cased) → button, for events without a code (e.g. synthetic ones). */
const BY_KEY: Readonly<Record<string, ButtonName>> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  z: 'a',
  k: 'a',
  x: 'b',
  j: 'b',
  enter: 'start',
  shift: 'select',
  backspace: 'select',
};

/** The parts of a KeyboardEvent the mapping reads. */
export interface KeyEventLike {
  key: string;
  code: string;
  repeat: boolean;
  target: EventTarget | null;
  preventDefault(): void;
}

/** Where key events are listened for (normally window). */
export type KeyTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/** Button for a key event, or null if it is not a game key. */
export function buttonForKey(e: Pick<KeyEventLike, 'key' | 'code'>): ButtonName | null {
  return BY_CODE[e.code ?? ''] ?? BY_KEY[(e.key ?? '').toLowerCase()] ?? null;
}

/** Stable id of a physical key across keydown/keyup (key text survives synthetic events). */
const keyId = (e: Pick<KeyEventLike, 'key' | 'code'>): string =>
  e.key ? e.key.toLowerCase() : e.code;

/** True when the event comes from a form control, editable content or a [data-no-game-keys] area. */
export function isFromEditable(target: EventTarget | null): boolean {
  const el = target as
    (Partial<Pick<HTMLElement, 'closest' | 'isContentEditable'>> & object) | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return el.closest('input, select, textarea, [data-no-game-keys]') !== null;
}

/** True for focusable UI controls (not the on-screen game buttons, which carry data-pressed). */
export function isFocusedControl(target: EventTarget | null): boolean {
  const el = target as Partial<Pick<HTMLElement, 'closest'>> | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.closest('button:not([data-pressed]), a[href], [role="switch"]') !== null;
}

/**
 * Map keyboard events on `target` (normally window) to handheld buttons: Arrows/WASD = D-pad,
 * Z/K = A, X/J = B, Enter = START, Shift/Backspace = SELECT. Game keys get preventDefault; key
 * repeat is ignored; keys aimed at form controls or [data-no-game-keys] are left alone.
 * Returns a detach function.
 */
export function attachKeyboard(hub: InputHub, target: KeyTarget): () => void {
  const down = new Map<ButtonName, Set<string>>();

  const onKeyDown = (ev: Event): void => {
    const e = ev as unknown as KeyEventLike;
    const button = buttonForKey(e);
    if (!button || isFromEditable(e.target)) return;
    // Enter on a focused toolbar button / switch activates it instead of pressing START.
    if (button === 'start' && isFocusedControl(e.target)) return;
    e.preventDefault();
    if (e.repeat) return;
    const keys = down.get(button) ?? new Set<string>();
    keys.add(keyId(e));
    down.set(button, keys);
    hub.setButton(KEYBOARD_SOURCE, button, true);
  };

  const onKeyUp = (ev: Event): void => {
    const e = ev as unknown as KeyEventLike;
    const button = buttonForKey(e);
    if (!button) return;
    const keys = down.get(button);
    keys?.delete(keyId(e));
    if (!keys || keys.size === 0) hub.setButton(KEYBOARD_SOURCE, button, false);
    if (!isFromEditable(e.target)) e.preventDefault();
  };

  const onBlur = (): void => {
    down.clear();
    hub.clearSource(KEYBOARD_SOURCE);
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
    onBlur();
  };
}
