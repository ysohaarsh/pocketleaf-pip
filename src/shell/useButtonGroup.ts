import { useEffect, useRef } from 'react';
import type { ButtonName } from '../game/types';
import type { InputHub } from '../input/InputState';
import { attachButtons, type ButtonTarget } from '../input/touch';

/**
 * Wires a set of buttons a finger may slide between. Returns a ref callback factory:
 * `bind('a')` registers the element for button A.
 */
export function useButtonGroup(input: InputHub, names: readonly ButtonName[]) {
  const elements = useRef(new Map<ButtonName, HTMLButtonElement>());
  const key = names.join(',');

  useEffect(() => {
    const targets: ButtonTarget[] = [];
    for (const name of key.split(',') as ButtonName[]) {
      const el = elements.current.get(name);
      if (el) targets.push({ el, name });
    }
    return attachButtons(targets, input);
  }, [input, key]);

  return (name: ButtonName) => (el: HTMLButtonElement | null) => {
    if (el) elements.current.set(name, el);
    else elements.current.delete(name);
  };
}
