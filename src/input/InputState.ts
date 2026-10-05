import { BUTTON_NAMES, type ButtonName, type Buttons, type InputFrame } from '../game/types';

/** A fresh all-released button set. */
export function emptyButtons(): Buttons {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    start: false,
    select: false,
  };
}

/** Pure edge detection between two held snapshots. */
export function makeFrame(prev: Buttons, held: Buttons, latched?: Buttons): InputFrame {
  const pressed = emptyButtons();
  const released = emptyButtons();
  for (const name of BUTTON_NAMES) {
    pressed[name] = (held[name] && !prev[name]) || (latched?.[name] ?? false);
    released[name] = !held[name] && prev[name];
  }
  return { held: { ...held }, pressed, released };
}

/**
 * Merges every input source (keyboard, touch, gamepad) into one InputState.
 * Sources write their own held set; the simulation samples once per fixed tick;
 * the shell subscribes so on-screen buttons depress for any source.
 */
export class InputHub {
  private readonly sources = new Map<string, Buttons>();
  private merged: Buttons = emptyButtons();
  private lastSampled: Buttons = emptyButtons();
  /** Presses seen since the last sample, so sub-tick taps are never lost. */
  private latched: Buttons = emptyButtons();
  /**
   * Buttons dropped by clearAll() since the last sample. A source re-asserting one of them before
   * the next sample (a gamepad still held after a blur) restores it as held, not as a new press.
   */
  private cleared: Buttons = emptyButtons();
  private readonly listeners = new Set<() => void>();

  /** Replace the held state contributed by one source. */
  setSource(id: string, held: Partial<Buttons>): void {
    const next = { ...emptyButtons(), ...held };
    this.sources.set(id, next);
    this.recompute();
  }

  /** Set a single button for a source. */
  setButton(id: string, name: ButtonName, down: boolean): void {
    const cur = this.sources.get(id) ?? emptyButtons();
    if (cur[name] === down) return;
    this.setSource(id, { ...cur, [name]: down });
  }

  clearSource(id: string): void {
    if (this.sources.delete(id)) this.recompute();
  }

  /** Release everything (e.g. on window blur). */
  clearAll(): void {
    for (const name of BUTTON_NAMES) if (this.merged[name]) this.cleared[name] = true;
    this.sources.clear();
    this.recompute();
  }

  /** Merged held state. Identity changes only when the value changes (useSyncExternalStore-safe). */
  getHeld = (): Buttons => this.merged;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called once per simulation tick. */
  sample(): InputFrame {
    const frame = makeFrame(this.lastSampled, this.merged, this.latched);
    this.lastSampled = { ...this.merged };
    this.latched = emptyButtons();
    this.cleared = emptyButtons();
    return frame;
  }

  private recompute(): void {
    const next = emptyButtons();
    for (const src of this.sources.values()) {
      for (const name of BUTTON_NAMES) if (src[name]) next[name] = true;
    }
    let changed = false;
    for (const name of BUTTON_NAMES) {
      if (next[name] !== this.merged[name]) changed = true;
      if (next[name] && !this.merged[name] && !this.cleared[name]) this.latched[name] = true;
    }
    if (!changed) return;
    this.merged = next;
    for (const l of this.listeners) l();
  }
}
