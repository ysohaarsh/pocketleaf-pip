import { describe, expect, it } from 'vitest';
import { cameraTarget } from '../../src/game/camera';
import { CAMERA_DEADZONE, CAMERA_LOOKAHEAD, SCREEN_W, TILE } from '../../src/game/constants';
import { FLAT, play } from './engineHelpers';

/** FLAT with a tall wall before the Beacon so Pip can run into the right side without clearing. */
const WALLED = FLAT.map((r, i) => (i < 7 ? `${r.slice(0, 35)}X${r.slice(36)}` : r));

describe('camera', () => {
  it('starts clamped at the level start and follows Pip with integer positions', () => {
    const d = play(FLAT);
    expect(d.world.camera.x).toBe(0);
    let last = 0;
    for (let i = 0; i < 200; i++) {
      d.tick({ right: true, b: true });
      const x = d.world.camera.x;
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(last);
      last = x;
      const p = d.world.player;
      const focus = p.x + p.w / 2 + CAMERA_LOOKAHEAD;
      // Pip never escapes the deadzone by more than a pixel of rounding while running right.
      if (x > 0 && x < FLAT[0]!.length * TILE - SCREEN_W)
        expect(focus - (x + SCREEN_W / 2)).toBeLessThanOrEqual(CAMERA_DEADZONE + 1);
    }
    expect(d.world.camera.y).toBe(0);
  });

  it('never scrolls past the level end and allows backtracking', () => {
    const d = play(WALLED);
    d.run(600, { right: true, b: true });
    expect(d.world.scene).toBe('playing');
    const max = FLAT[0]!.length * TILE - SCREEN_W;
    expect(d.world.camera.x).toBeLessThanOrEqual(max);
    const atEnd = d.world.camera.x;
    d.run(120, { left: true });
    expect(d.world.camera.x).toBeLessThan(atEnd);
    d.run(600, { left: true, b: true });
    expect(d.world.camera.x).toBe(0);
  });

  it('target stays put while Pip is inside the deadzone', () => {
    const d = play(FLAT);
    d.world.camera.x = 100;
    d.world.player.x = 100 + SCREEN_W / 2 - d.world.player.w / 2 - CAMERA_LOOKAHEAD;
    expect(cameraTarget(d.world)).toBe(100);
  });
});
