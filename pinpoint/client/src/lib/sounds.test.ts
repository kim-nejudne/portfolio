// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySoundMode,
  playFlap,
  playSound,
  preloadSounds,
  resetSounds,
  startSounds,
} from './sounds.js';
import { cycleSoundMode } from './soundMode.js';

const fake = vi.hoisted(() => {
  const howls: { src: string; loop: boolean; plays: number; stops: number[] }[] = [];
  const Howler = {
    volume: (v: number) => void fake.volumes.push(v),
    ctx: { state: 'running', resumes: 0, resume: async () => void fake.Howler.ctx.resumes++ },
  };
  class Howl {
    src: string;
    loop: boolean;
    plays = 0;
    stops: number[] = [];
    constructor(o: { src: string[]; loop?: boolean }) {
      this.src = o.src[0]!;
      this.loop = !!o.loop;
      howls.push(this);
    }
    play() {
      this.plays++;
      return 40 + this.plays;
    }
    stop(id: number) {
      this.stops.push(id);
    }
  }
  return { howls, volumes: [] as number[], Howl, Howler };
});
vi.mock('howler', () => ({ Howl: fake.Howl, Howler: fake.Howler }));

const howl = (name: string) => fake.howls.find((h) => h.src === `/sounds/${name}.wav`)!;

beforeEach(() => {
  localStorage.clear();
  fake.howls.length = 0;
  fake.volumes.length = 0;
});

afterEach(() => {
  resetSounds();
  vi.useRealTimers();
});

describe('sounds', () => {
  it('plays nothing on a device that never started sounds, so phones stay silent', () => {
    playSound('tick');
    playFlap(1000);
    expect(fake.howls).toHaveLength(0);
  });

  it('loads the five sounds at the stored mode volume, with the clatter looped', async () => {
    localStorage.setItem('pinpoint:sound', 'Quiet');
    await startSounds();
    expect(fake.howls.map((h) => h.src)).toEqual([
      '/sounds/flap.wav',
      '/sounds/chime.wav',
      '/sounds/tick.wav',
      '/sounds/thud.wav',
      '/sounds/fanfare.wav',
    ]);
    expect(howl('flap').loop).toBe(true);
    expect(howl('tick').loop).toBe(false);
    expect(fake.volumes).toEqual([0.4]);
    playSound('chime');
    expect(howl('chime').plays).toBe(1);
  });

  it('with Howler preloaded, the click resumes audio before anything is awaited', async () => {
    preloadSounds();
    await vi.dynamicImportSettled();
    fake.Howler.ctx.state = 'suspended';
    fake.Howler.ctx.resumes = 0;
    try {
      const started = startSounds();
      expect(fake.Howler.ctx.resumes).toBe(1); // still inside the click's call stack
      await started;
    } finally {
      fake.Howler.ctx.state = 'running';
    }
  });

  it('a double click builds one set of sounds', async () => {
    await Promise.all([startSounds(), startSounds()]);
    expect(fake.howls).toHaveLength(5);
  });

  it('M cycles the volume Quiet 40%, Muted 0, Sound 100%, and the mode persists', async () => {
    await startSounds();
    for (const expected of ['Quiet', 'Muted', 'Sound'] as const) {
      const mode = cycleSoundMode();
      expect(mode).toBe(expected);
      applySoundMode(mode);
      expect(localStorage.getItem('pinpoint:sound')).toBe(expected);
    }
    expect(fake.volumes).toEqual([1, 0.4, 0, 1]);
    // A reload starts at the stored mode.
    cycleSoundMode();
    resetSounds();
    fake.volumes.length = 0;
    await startSounds();
    expect(fake.volumes).toEqual([0.4]);
  });

  it('trims the clatter to the row, stretching one clatter when rows overlap', async () => {
    await startSounds();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    playFlap(1000);
    vi.advanceTimersByTime(400);
    playFlap(1000); // ends at 1400 ms: stretches the first
    playFlap(300); // ends sooner: changes nothing
    expect(howl('flap').plays).toBe(1);
    vi.advanceTimersByTime(999);
    expect(howl('flap').stops).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(howl('flap').stops).toEqual([41]);
    playFlap(200);
    expect(howl('flap').plays).toBe(2);
  });
});
