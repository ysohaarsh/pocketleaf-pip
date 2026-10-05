import type { World } from './types';

/** Keys of World left out of the hash: static input data and per-tick side effects. */
const EXCLUDED: ReadonlySet<string> = new Set(['levels', 'events']);

/** Floats are rounded to this precision so the hash ignores sub-1e-4 noise. */
const PRECISION = 1e4;

function serialize(value: unknown, out: string[]): void {
  if (typeof value === 'number') {
    out.push(String(Math.round(value * PRECISION)));
  } else if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
    out.push(JSON.stringify(value));
  } else if (value instanceof Uint8Array || Array.isArray(value)) {
    out.push('[');
    for (const v of value as Iterable<unknown>) {
      serialize(v, out);
      out.push(',');
    }
    out.push(']');
  } else if (typeof value === 'object') {
    out.push('{');
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj).sort()) {
      out.push(key, ':');
      serialize(obj[key], out);
      out.push(',');
    }
    out.push('}');
  } else {
    out.push('u');
  }
}

/** 32-bit FNV-1a of a string, as 8 hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic hash of the simulation state (excluding `levels` and `events`) for replay tests. */
export function hashWorld(world: World): string {
  const out: string[] = [];
  const top = world as unknown as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(top)) if (!EXCLUDED.has(key)) filtered[key] = top[key];
  serialize(filtered, out);
  return fnv1a(out.join(''));
}
