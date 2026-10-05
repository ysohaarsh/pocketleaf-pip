import { BUTTON_NAMES, type Buttons } from '../game/types';
import { emptyButtons, type InputHub } from './InputState';

/** Source id gamepads write into the InputHub. */
export const GAMEPAD_SOURCE = 'gamepad';

/** Left-stick deadzone (fraction of full deflection). */
export const STICK_DEADZONE = 0.3;

/** The parts of a Gamepad the poller reads (real Gamepads satisfy this). */
export interface PadLike {
  index: number;
  connected: boolean;
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

export interface GamepadPollerOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface GamepadPoller {
  /** Read every pad, merge into the hub. Returns true if any button went down since the last poll. */
  poll(): boolean;
  /** Number of pads seen connected at the last poll. */
  connectedCount(): number;
}

const pressed = (pad: PadLike, i: number): boolean => pad.buttons[i]?.pressed ?? false;

/** Standard-mapping pad → buttons (A=0, B=1|2, SELECT=8, START=9, D-pad 12-15, left stick). */
export function readPad(pad: PadLike): Buttons {
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  return {
    a: pressed(pad, 0),
    b: pressed(pad, 1) || pressed(pad, 2),
    select: pressed(pad, 8),
    start: pressed(pad, 9),
    up: pressed(pad, 12) || y < -STICK_DEADZONE,
    down: pressed(pad, 13) || y > STICK_DEADZONE,
    left: pressed(pad, 14) || x < -STICK_DEADZONE,
    right: pressed(pad, 15) || x > STICK_DEADZONE,
  };
}

function defaultPads(): readonly (PadLike | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return navigator.getGamepads();
}

/**
 * Polls the Gamepad API every frame (no reliance on connect events), merges all pads into the
 * 'gamepad' source, and reports connect/disconnect transitions via callbacks.
 */
export function createGamepadPoller(
  hub: InputHub,
  getPads: () => readonly (PadLike | null)[] = defaultPads,
  opts: GamepadPollerOptions = {},
): GamepadPoller {
  let known = new Set<number>();
  let prev = emptyButtons();

  return {
    poll() {
      let pads: readonly (PadLike | null)[];
      try {
        pads = getPads();
      } catch {
        pads = [];
      }
      const now = new Set<number>();
      const merged = emptyButtons();
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        now.add(pad.index);
        const b = readPad(pad);
        for (const name of BUTTON_NAMES) if (b[name]) merged[name] = true;
      }
      const added = [...now].some((i) => !known.has(i));
      const removed = [...known].some((i) => !now.has(i));
      known = now;
      if (removed) opts.onDisconnect?.();
      if (added) opts.onConnect?.();

      let anyPressed = false;
      for (const name of BUTTON_NAMES) if (merged[name] && !prev[name]) anyPressed = true;
      const changed = BUTTON_NAMES.some((n) => merged[n] !== prev[n]);
      prev = merged;
      if (now.size === 0) hub.clearSource(GAMEPAD_SOURCE);
      else if (changed || removed || added) hub.setSource(GAMEPAD_SOURCE, merged);
      return anyPressed;
    },
    connectedCount: () => known.size,
  };
}
