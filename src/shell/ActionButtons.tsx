import type { InputHub } from '../input/InputState';
import { useButtonGroup } from './useButtonGroup';
import { useHeldButtons } from './useGameHost';

const NAMES = ['b', 'a'] as const;
const LABELS = { a: 'A button', b: 'B button' } as const;

/** A and B on a diagonal (B lower-left, A upper-right), each in its own ring; a thumb may roll between them. */
export function ActionButtons({ input }: { input: InputHub }) {
  const held = useHeldButtons(input);
  const bind = useButtonGroup(input, NAMES);

  return (
    <div className="action" role="group" aria-label="Action buttons">
      {NAMES.map((name) => (
        <div key={name} className={`action__slot action__slot--${name}`}>
          <button
            ref={bind(name)}
            type="button"
            tabIndex={-1}
            className="action__btn"
            aria-label={LABELS[name]}
            data-testid={`btn-${name}`}
            data-pressed={held[name] ? 'true' : 'false'}
          />
          <span className="action__label" aria-hidden="true">
            {name.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}
