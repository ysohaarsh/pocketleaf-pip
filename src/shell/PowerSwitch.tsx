interface PowerSwitchProps {
  powered: boolean;
  onToggle(): void;
}

/** Slide switch on the top edge of the body. */
export function PowerSwitch({ powered, onToggle }: PowerSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={powered}
      aria-label="Power"
      data-testid="power-switch"
      className="power"
      onClick={onToggle}
    >
      <span className="power__text" aria-hidden="true">
        OFF
      </span>
      <span className="power__track" aria-hidden="true">
        <span className="power__knob" />
      </span>
      <span className="power__text" aria-hidden="true">
        ON
      </span>
    </button>
  );
}
