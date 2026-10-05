import type { Sprite, SpriteId } from '../game/types';

// STUB — replaced by feat/content.
export function getSprite(_id: SpriteId): Sprite {
  return { w: 1, h: 1, pixels: new Uint8Array(1) };
}
