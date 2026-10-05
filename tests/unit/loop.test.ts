import { describe, expect, it } from 'vitest';
import { DT, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } from '../../src/game/constants';
import { createLoop } from '../../src/engine/loop';

/** A manual clock + rAF so frames run only when the test says so. */
function harness() {
  let t = 1000;
  let pending: (() => void) | null = null;
  let nextId = 1;
  const cancelled: number[] = [];
  let steps = 0;
  const alphas: number[] = [];
  const order: string[] = [];
  const loop = createLoop({
    now: () => t,
    raf: (cb) => {
      pending = cb;
      return nextId++;
    },
    caf: (id) => {
      cancelled.push(id);
      pending = null;
    },
    beforeSteps: () => order.push('poll'),
    step: () => {
      steps++;
      order.push('step');
    },
    render: (a) => {
      alphas.push(a);
      order.push('render');
    },
  });
  return {
    loop,
    cancelled,
    order,
    alphas,
    steps: () => steps,
    /** Advance the clock by ms and run the pending frame. */
    frame(ms: number) {
      t += ms;
      const cb = pending;
      pending = null;
      cb?.();
    },
    hasPending: () => pending !== null,
  };
}

describe('fixed-timestep loop', () => {
  it('runs one step per 1/60 s of elapsed time and carries the remainder', () => {
    const h = harness();
    h.loop.start();
    expect(h.loop.isRunning()).toBe(true);
    for (let i = 0; i < 60; i++) h.frame(1000 / 60);
    expect(h.steps()).toBe(60);
    // 120 Hz display: one step every other frame.
    for (let i = 0; i < 20; i++) h.frame(1000 / 120);
    expect(h.steps()).toBe(70);
    expect(h.alphas.at(-1)).toBeCloseTo(0, 5);
    h.frame(1000 / 120);
    expect(h.alphas.at(-1)).toBeCloseTo(0.5, 5);
    // 30 Hz display: two steps per frame.
    const before = h.steps();
    h.frame(1000 / 30);
    expect(h.steps() - before).toBe(2);
    expect(h.order.slice(-4)).toEqual(['poll', 'step', 'step', 'render']);
  });

  it('clamps long frames and caps steps per frame, dropping the backlog', () => {
    const h = harness();
    h.loop.start();
    h.frame(5000);
    expect(h.steps()).toBe(Math.min(MAX_STEPS_PER_FRAME, Math.floor(MAX_FRAME_TIME / DT)));
    expect(h.steps()).toBe(MAX_STEPS_PER_FRAME);
    // The backlog was dropped: the next normal frame runs a single step.
    h.frame(1000 / 60);
    expect(h.steps()).toBe(MAX_STEPS_PER_FRAME + 1);
  });

  it('stop cancels the pending frame; start is idempotent and resets the clock', () => {
    const h = harness();
    h.loop.start();
    h.loop.start();
    h.frame(1000 / 60);
    h.loop.stop();
    h.loop.stop();
    expect(h.loop.isRunning()).toBe(false);
    expect(h.cancelled).toHaveLength(1);
    expect(h.hasPending()).toBe(false);
    h.loop.start();
    h.frame(1000 / 60);
    expect(h.steps()).toBe(2);
  });

  it('reports frame stats over a rolling window', () => {
    const h = harness();
    expect(h.loop.stats()).toEqual({ frames: 0, avgFrameMs: 0, maxFrameMs: 0 });
    h.loop.start();
    h.frame(10);
    h.frame(20);
    h.frame(30);
    expect(h.loop.stats()).toEqual({ frames: 3, avgFrameMs: 20, maxFrameMs: 30 });
    for (let i = 0; i < 200; i++) h.frame(16);
    const s = h.loop.stats();
    expect(s.frames).toBe(203);
    expect(s.avgFrameMs).toBe(16);
    expect(s.maxFrameMs).toBe(16);
  });

  it('a render callback that stops the loop prevents the next frame', () => {
    let pending: (() => void) | null = null;
    let t = 0;
    const loop = createLoop({
      now: () => t,
      raf: (cb) => {
        pending = cb;
        return 1;
      },
      caf: () => undefined,
      step: () => undefined,
      render: () => loop.stop(),
    });
    loop.start();
    t += 16;
    const cb = pending as (() => void) | null;
    pending = null;
    cb?.();
    expect(pending).toBeNull();
  });
});
