import { useEffect, useRef } from 'react';
import type { InputHub } from '../input/InputState';
import { attachDpad } from '../input/touch';
import { useHeldButtons } from './useGameHost';

const ARMS = [
  { dir: 'up', label: 'D-pad up' },
  { dir: 'right', label: 'D-pad right' },
  { dir: 'down', label: 'D-pad down' },
  { dir: 'left', label: 'D-pad left' },
] as const;

/** One cross: the direction follows the pointer around the centre (diagonals in the corners). */
export function Dpad({ input }: { input: InputHub }) {
  const ref = useRef<HTMLDivElement>(null);
  const held = useHeldButtons(input);

  useEffect(() => {
    const el = ref.current;
    return el ? attachDpad(el, input) : undefined;
  }, [input]);

  return (
    <div className="dpad" ref={ref} role="group" aria-label="Direction pad">
      <div className="dpad__cross" aria-hidden="true">
        <span className="dpad__hub" />
      </div>
      {ARMS.map(({ dir, label }) => (
        <button
          key={dir}
          type="button"
          tabIndex={-1}
          className={`dpad__arm dpad__arm--${dir}`}
          aria-label={label}
          data-testid={`btn-${dir}`}
          data-pressed={held[dir] ? 'true' : 'false'}
        >
          <span className="dpad__arrow" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
