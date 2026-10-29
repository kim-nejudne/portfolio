// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fx } from '../../../shared/types.js';
import {
  cycleSoundLevel,
  getSoundLevel,
  playSound,
  resetSounds,
  SOUND_LEVEL_LABEL,
  SOUND_NAMES,
  soundForFx,
  soundUrl,
  startSounds,
  subscribeSoundLevel,
  type SoundName,
} from './sounds.js';

const howler = vi.hoisted(() => {
  const created: { src: string[]; play: () => void }[] = [];
  const ctx = { state: 'suspended', resume: vi.fn(() => Promise.resolve()) };
  // How many sounds existed at each global volume change, to check the order.
  const volume = vi.fn<(level: number) => number>(() => created.length);
  return { created, ctx, volume, fail: false };
});

vi.mock('howler', () => ({
  Howl: class {
    src: string[];
    play = vi.fn();
    constructor({ src }: { src: string[] }) {
      if (howler.fail) throw new Error('no audio');
      this.src = src;
      howler.created.push(this);
    }
  },
  Howler: { ctx: howler.ctx, volume: howler.volume },
}));

beforeEach(() => {
  resetSounds();
  howler.created.length = 0;
  howler.fail = false;
  howler.ctx.state = 'suspended';
  howler.ctx.resume.mockClear();
  howler.volume.mockClear();
  localStorage.clear();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const howlFor = (name: SoundName) => howler.created.find((h) => h.src[0] === soundUrl(name))!;

describe('sounds', () => {
  it('every fx kind has its own sound, including a new one for time up', () => {
    const fxs: Fx[] = [
      { kind: 'buzz', playerId: 'p1', gaps: [] },
      { kind: 'correct', playerId: 'p1', points: 100 },
      { kind: 'wrong', playerId: 'p1' },
      { kind: 'timeUp', playerId: 'p1' },
      { kind: 'join', playerId: 'p1' },
    ];
    expect(fxs.map(soundForFx)).toEqual(['buzz', 'correct', 'wrong', 'timeUp', 'join']);
  });

  it('a lobby test buzz plays its own practice sound', () => {
    expect(soundForFx({ kind: 'practice', playerId: 'p1' })).toBe('practice');
  });

  it('nobody buzzing in time plays the time-up sound', () => {
    expect(soundForFx({ kind: 'buzzTimeUp' })).toBe('timeUp');
  });

  it('every sound has a file in client/public/sounds', () => {
    // Lists the files without loading them.
    const files = Object.keys(import.meta.glob('../../public/sounds/*.wav')).sort();
    expect(files).toEqual(SOUND_NAMES.map((name) => `../../public${soundUrl(name)}`).sort());
  });

  it('plays nothing before startSounds', () => {
    playSound('buzz');
    expect(howler.created).toEqual([]);
  });

  it('startSounds loads each sound once and resumes a suspended AudioContext', async () => {
    await startSounds();
    await startSounds();
    expect(howler.created.map((h) => h.src)).toEqual(SOUND_NAMES.map((n) => [soundUrl(n)]));
    expect(howler.ctx.resume).toHaveBeenCalledOnce();
  });

  it('playSound plays only the named sound, and logs it for the playtest', async () => {
    await startSounds();
    playSound('correct');
    for (const name of SOUND_NAMES) {
      expect(howlFor(name).play).toHaveBeenCalledTimes(name === 'correct' ? 1 : 0);
    }
    expect(console.debug).toHaveBeenCalledWith('[sound] correct');
  });

  it('a Howler failure leaves the Screen silent instead of throwing', async () => {
    howler.fail = true;
    await expect(startSounds()).resolves.toBeUndefined();
    expect(() => playSound('buzz')).not.toThrow();
  });
});

describe('sound level', () => {
  it('starts at Sound on and cycles Quiet, Muted, then Sound on', () => {
    const seen = [getSoundLevel()];
    for (let i = 0; i < 3; i++) {
      cycleSoundLevel();
      seen.push(getSoundLevel());
    }
    expect(seen).toEqual(['on', 'quiet', 'muted', 'on']);
    expect(seen.map((level) => SOUND_LEVEL_LABEL[level])).toEqual([
      'Sound on',
      'Quiet',
      'Muted',
      'Sound on',
    ]);
  });

  it('is kept in localStorage, so the device remembers it', () => {
    cycleSoundLevel();
    expect(localStorage.getItem('buzzr:soundLevel')).toBe('quiet');
    resetSounds();
    expect(getSoundLevel()).toBe('quiet');
  });

  it('ignores a stored value that is not a level', () => {
    localStorage.setItem('buzzr:soundLevel', 'loud');
    expect(getSoundLevel()).toBe('on');
  });

  it('still cycles in memory when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    cycleSoundLevel();
    expect(getSoundLevel()).toBe('quiet');
  });

  it('startSounds applies the stored level through Howler before the first sound exists', async () => {
    localStorage.setItem('buzzr:soundLevel', 'quiet');
    await startSounds();
    expect(howler.volume).toHaveBeenCalledExactlyOnceWith(0.4);
    expect(howler.volume.mock.results[0]!.value).toBe(0);
  });

  it('a change after startSounds sets Howler’s volume at once: 40 % Quiet, 0 Muted, 1 Sound on', async () => {
    await startSounds();
    howler.volume.mockClear();
    cycleSoundLevel();
    cycleSoundLevel();
    cycleSoundLevel();
    expect(howler.volume.mock.calls).toEqual([[0.4], [0], [1]]);
  });

  it('a change before startSounds waits for it, and tells subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundLevel(listener);
    cycleSoundLevel();
    unsubscribe();
    cycleSoundLevel();
    expect(listener).toHaveBeenCalledOnce();
    expect(howler.volume).not.toHaveBeenCalled();
  });
});
