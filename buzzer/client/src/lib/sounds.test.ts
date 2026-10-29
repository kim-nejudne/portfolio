import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fx } from '../../../shared/types.js';
import {
  playSound,
  resetSounds,
  SOUND_NAMES,
  soundForFx,
  soundUrl,
  startSounds,
  type SoundName,
} from './sounds.js';

const howler = vi.hoisted(() => {
  const created: { src: string[]; play: () => void }[] = [];
  const ctx = { state: 'suspended', resume: vi.fn(() => Promise.resolve()) };
  return { created, ctx, fail: false };
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
  Howler: { ctx: howler.ctx },
}));

beforeEach(() => {
  resetSounds();
  howler.created.length = 0;
  howler.fail = false;
  howler.ctx.state = 'suspended';
  howler.ctx.resume.mockClear();
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

  it('plays nothing for a lobby test buzz', () => {
    expect(soundForFx({ kind: 'practice', playerId: 'p1' })).toBeNull();
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
