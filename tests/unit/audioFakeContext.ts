/** A recording fake of the Web Audio slice used by src/audio (no real AudioContext in node). */
import type {
  BufferLike,
  BufferSourceLike,
  ChipContext,
  FilterLike,
  GainLike,
  NodeLike,
  OscillatorLike,
  ParamLike,
  WaveLike,
} from '../../src/audio/synth';

export type ParamCall = [method: string, value: number, time: number];

export class FakeParam implements ParamLike {
  value: number;
  calls: ParamCall[] = [];
  constructor(value: number) {
    this.value = value;
  }
  setValueAtTime(value: number, time: number): void {
    this.calls.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['linear', value, time]);
  }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.calls.push(['exp', value, time]);
  }
  cancelScheduledValues(time: number): void {
    this.calls.push(['cancel', 0, time]);
  }
  /** The last scheduled target value (what the param settles at). */
  get last(): number | undefined {
    const ramps = this.calls.filter((c) => c[0] !== 'cancel');
    return ramps[ramps.length - 1]?.[1];
  }
}

export class FakeNode implements NodeLike {
  outputs: NodeLike[] = [];
  disconnects = 0;
  constructor(readonly kind: string) {}
  connect(destination: NodeLike): NodeLike {
    this.outputs.push(destination);
    return destination;
  }
  disconnect(): void {
    this.disconnects += 1;
    this.outputs = [];
  }
}

export class FakeGain extends FakeNode implements GainLike {
  readonly gain = new FakeParam(1);
  constructor() {
    super('gain');
  }
}

export class FakeFilter extends FakeNode implements FilterLike {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeParam(350);
  constructor() {
    super('filter');
  }
}

class FakeSource extends FakeNode {
  starts: number[] = [];
  stops: number[] = [];
  onended: ((ev: Event) => unknown) | null = null;
  start(when: number): void {
    this.starts.push(when);
  }
  stop(when: number): void {
    this.stops.push(when);
  }
  /** Simulate the browser's `ended` event. */
  fireEnded(): void {
    this.onended?.(new Event('ended'));
  }
}

export class FakeOscillator extends FakeSource implements OscillatorLike {
  readonly frequency = new FakeParam(440);
  wave: WaveLike | null = null;
  constructor() {
    super('oscillator');
  }
  setPeriodicWave(wave: WaveLike): void {
    this.wave = wave;
  }
}

export class FakeBufferSource extends FakeSource implements BufferSourceLike {
  buffer: BufferLike | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
  constructor() {
    super('bufferSource');
  }
}

export class FakeBuffer implements BufferLike {
  private readonly data: Float32Array;
  constructor(length: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

export class FakeContext implements ChipContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state = 'suspended';
  readonly destination = new FakeNode('destination');
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  bufferSources: FakeBufferSource[] = [];
  buffers: FakeBuffer[] = [];
  waves: { real: Float32Array; imag: Float32Array }[] = [];
  filters: FakeFilter[] = [];
  resumes = 0;
  closed = false;

  resume(): Promise<void> {
    this.resumes += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource(): FakeBufferSource {
    const s = new FakeBufferSource();
    this.bufferSources.push(s);
    return s;
  }
  createBuffer(_channels: number, length: number): FakeBuffer {
    const b = new FakeBuffer(length);
    this.buffers.push(b);
    return b;
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array): WaveLike {
    const w = { real, imag };
    this.waves.push(w);
    return w;
  }
  createBiquadFilter(): FakeFilter {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  /** All sources (oscillators and noise) in creation order. */
  get sources(): (FakeOscillator | FakeBufferSource)[] {
    return [...this.oscillators, ...this.bufferSources];
  }
}

/** Manual repeating timers: `fire()` runs every live callback once. */
export class FakeTimers {
  private next = 1;
  readonly live = new Map<number, () => void>();
  setInterval = (cb: () => void): number => {
    const id = this.next++;
    this.live.set(id, cb);
    return id;
  };
  clearInterval = (id: number): void => {
    this.live.delete(id);
  };
  fire(): void {
    for (const cb of [...this.live.values()]) cb();
  }
}
