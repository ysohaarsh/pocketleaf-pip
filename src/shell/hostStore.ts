import type { GameHost } from '../engine/api';

/** A created host plus everything that must be torn down with it (e.g. its audio engine). */
export interface HostHandle {
  host: GameHost;
  dispose(): void;
}

export interface HostStore {
  /** Ensure a host exists; the returned release destroys it when the last holder lets go. */
  acquire(): () => void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): GameHost | null;
}

/**
 * Reference-counted host lifetime, shaped as an external store so React can read it with
 * useSyncExternalStore. StrictMode's mount → unmount → mount destroys and recreates cleanly.
 */
export function createHostStore(factory: () => HostHandle): HostStore {
  let current: HostHandle | null = null;
  let holders = 0;
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const l of listeners) l();
  };

  return {
    acquire() {
      holders += 1;
      if (!current) {
        current = factory();
        emit();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holders -= 1;
        if (holders === 0 && current) {
          const handle = current;
          current = null;
          handle.dispose();
          emit();
        }
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => current?.host ?? null,
  };
}
