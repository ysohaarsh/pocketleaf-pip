import type { ButtonName, Buttons } from '../game/types';
import type { InputHub } from './InputState';

/**
 * Pointer-driven on-screen controls (touch, pen and mouse share one code path).
 * Every active pointer is its own InputHub source (`touch:<pointerId>`), so several
 * fingers on different controls merge naturally, and sliding a finger re-targets it.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The subset of PointerEvent this module reads. */
export interface PointerLike {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  preventDefault(): void;
}

type PointerListener = (e: PointerLike) => void;

/** The subset of HTMLElement this module needs (lets tests use plain fakes). */
export interface PointerSurface {
  addEventListener(
    type: string,
    listener: PointerListener,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(type: string, listener: PointerListener): void;
  getBoundingClientRect(): Rect;
  setPointerCapture(pointerId: number): void;
}

export interface TouchOptions {
  /** Haptic tick on press; defaults to a guarded navigator.vibrate. */
  vibrate?: (ms: number) => void;
}

type Directions = Partial<Pick<Buttons, 'up' | 'down' | 'left' | 'right'>>;

/** Radius (fraction of the D-pad half-size) around the centre that selects nothing. */
export const DPAD_DEADZONE = 0.18;
/** Beyond this offset on BOTH axes the pointer is in a corner zone and yields a diagonal. */
export const DPAD_DIAGONAL = 0.42;

const HAPTIC_MS = 10;

export function sourceId(pointerId: number): string {
  return `touch:${pointerId}`;
}

function defaultVibrate(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    // Haptics are optional.
  }
}

/** Directions for a point relative to the D-pad's bounding box (pure). */
export function dpadDirections(rect: Rect, x: number, y: number): Directions {
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  if (hw <= 0 || hh <= 0) return {};
  const nx = (x - (rect.left + hw)) / hw;
  const ny = (y - (rect.top + hh)) / hh;
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  if (Math.hypot(nx, ny) < DPAD_DEADZONE) return {};
  const horizontal: Directions = nx < 0 ? { left: true } : { right: true };
  const vertical: Directions = ny < 0 ? { up: true } : { down: true };
  if (ax > DPAD_DIAGONAL && ay > DPAD_DIAGONAL) return { ...horizontal, ...vertical };
  return ax >= ay ? horizontal : vertical;
}

export interface ButtonTarget {
  el: PointerSurface;
  name: ButtonName;
}

function contains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
  );
}

/** Which button of a group lies under the point, if any (pure given the rects). */
export function hitButton(
  targets: readonly ButtonTarget[],
  x: number,
  y: number,
): ButtonName | null {
  for (const t of targets) if (contains(t.el.getBoundingClientRect(), x, y)) return t.name;
  return null;
}

function sameButtons(a: Partial<Buttons>, b: Partial<Buttons>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as ButtonName[]);
  for (const k of keys) if (Boolean(a[k]) !== Boolean(b[k])) return false;
  return true;
}

function addsPress(prev: Partial<Buttons>, next: Partial<Buttons>): boolean {
  return (Object.keys(next) as ButtonName[]).some((k) => next[k] === true && prev[k] !== true);
}

/**
 * Shared pointer tracking: `resolve` maps a pointer position to the buttons it holds.
 * Returns a cleanup that detaches listeners and releases any held pointers.
 */
function trackPointers(
  surfaces: readonly PointerSurface[],
  hub: InputHub,
  resolve: (x: number, y: number) => Partial<Buttons>,
  options: TouchOptions,
): () => void {
  const vibrate = options.vibrate ?? defaultVibrate;
  const active = new Map<number, Partial<Buttons>>();

  const update = (e: PointerLike, isDown: boolean): void => {
    const prev = active.get(e.pointerId) ?? {};
    const next = resolve(e.clientX, e.clientY);
    active.set(e.pointerId, next);
    if (!isDown && sameButtons(prev, next)) return;
    hub.setSource(sourceId(e.pointerId), next);
    if (addsPress(prev, next)) vibrate(HAPTIC_MS);
  };

  const release = (e: PointerLike): void => {
    if (!active.delete(e.pointerId)) return;
    hub.clearSource(sourceId(e.pointerId));
  };

  const listeners = surfaces.map((surface) => {
    const onDown: PointerListener = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail for synthetic events; tracking still works on this surface.
      }
      update(e, true);
    };
    const onMove: PointerListener = (e) => {
      if (!active.has(e.pointerId)) return;
      e.preventDefault();
      update(e, false);
    };
    const onUp: PointerListener = (e) => {
      if (active.has(e.pointerId)) e.preventDefault();
      release(e);
    };
    const onContextMenu: PointerListener = (e) => e.preventDefault();
    const map: [string, PointerListener][] = [
      ['pointerdown', onDown],
      ['pointermove', onMove],
      ['pointerup', onUp],
      ['pointercancel', release],
      ['lostpointercapture', release],
      ['contextmenu', onContextMenu],
    ];
    for (const [type, fn] of map) surface.addEventListener(type, fn, { passive: false });
    return () => {
      for (const [type, fn] of map) surface.removeEventListener(type, fn);
    };
  });

  return () => {
    for (const detach of listeners) detach();
    for (const id of active.keys()) hub.clearSource(sourceId(id));
    active.clear();
  };
}

/** One cross-shaped D-pad: direction comes from the pointer offset to its centre. */
export function attachDpad(
  el: PointerSurface,
  hub: InputHub,
  options: TouchOptions = {},
): () => void {
  return trackPointers(
    [el],
    hub,
    (x, y) => dpadDirections(el.getBoundingClientRect(), x, y),
    options,
  );
}

/**
 * A group of buttons a finger may slide between (A↔B, START↔SELECT).
 * Sliding off every button of the group releases until the finger slides back on.
 */
export function attachButtons(
  targets: readonly ButtonTarget[],
  hub: InputHub,
  options: TouchOptions = {},
): () => void {
  return trackPointers(
    targets.map((t) => t.el),
    hub,
    (x, y) => {
      const name = hitButton(targets, x, y);
      return name ? { [name]: true } : {};
    },
    options,
  );
}
