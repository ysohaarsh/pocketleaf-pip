import type { InputHub } from '../input/InputState';
import { useButtonGroup } from './useButtonGroup';
import { useHeldButtons } from './useGameHost';

const NAMES = ['select', 'start'] as const;
const LABELS = { select: 'Select', start: 'Start' } as const;

/** SELECT and START: small angled pills with a generous invisible hit area. */
export function MetaButtons({ input }: { input: InputHub }) {
  const held = useHeldButtons(input);
  const bind = useButtonGroup(input, NAMES);

  return (
    <div className="meta" role="group" aria-label="Start and select">
      {NAMES.map((name) => (
        <button
          key={name}
          ref={bind(name)}
          type="button"
          tabIndex={-1}
          className="meta__btn"
          aria-label={LABELS[name]}
          data-testid={`btn-${name}`}
          data-pressed={held[name] ? 'true' : 'false'}
        >
          <span className="meta__pill" aria-hidden="true" />
          <span className="meta__label" aria-hidden="true">
            {name.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}
