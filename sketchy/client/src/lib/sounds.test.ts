import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fx } from '../../../shared/types.js';
import { loadSoundLevel, resetSoundLevel, saveSoundLevel } from './soundPref.js';
import {
  createScreenSounds,
  nextTick,
  playSound,
  preloadSounds,
  resetSounds,
  SOUND_NAMES,
  soundForFx,
  soundUrl,
  startSounds,
  STING_AFTER_TIME_UP_MS,
  transitionSounds,
  type SoundInput,
  type SoundName,
  type SoundState,
} from './sounds.js';

const howler = vi.hoisted(() => {
  const created: { src: string[]; play: () => void }[] = [];
  // The one-sample silent buffers started to unlock iOS.
  const silences = { started: 0 };
  const ctx = {
    state: 'suspended',
    resume: vi.fn(() => Promise.resolve()),
    destination: {},
    createBuffer: () => ({}),
    createBufferSource: () => ({ connect: () => {}, start: () => void silences.started++ }),
  };
  // How many sounds existed at each global volume change, to check the order.
  const volume = vi.fn<(level: number) => number>(() => created.length);
  const global = { ctx, volume, autoSuspend: true };
  return { created, ctx, silences, volume, global, fail: false, loaded: true };
});

vi.mock('howler', () => ({
  Howl: class {
    src: string[];
    play = vi.fn();
    state = () => (howler.loaded ? 'loaded' : 'loading');
    constructor({ src }: { src: string[] }) {
      if (howler.fail) throw new Error('no audio');
      this.src = src;
      howler.created.push(this);
    }
  },
  Howler: howler.global,
}));

beforeEach(() => {
  resetSounds();
  resetSoundLevel();
  howler.created.length = 0;
  howler.fail = false;
  howler.loaded = true;
  howler.global.autoSuspend = true;
  howler.silences.started = 0;
  howler.ctx.state = 'suspended';
  howler.ctx.resume.mockClear();
  howler.volume.mockClear();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', new EventTarget());
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const howlFor = (name: SoundName) => howler.created.find((h) => h.src[0] === soundUrl(name))!;

const s = (
  phase: SoundState['phase'],
  turnId: number | null = null,
  endReason: SoundState['endReason'] = null,
): SoundState => ({ phase, turnId, endReason });

describe('soundForFx', () => {
  it('a join pops and a correct guess dings', () => {
    expect(soundForFx({ kind: 'join', pid: 'p1' })).toBe('join');
    expect(soundForFx({ kind: 'correct', pid: 'p1', points: 270, order: 1 })).toBe('correct');
  });

  it('every other fx is silent on the Screen', () => {
    const silent: Fx[] = [
      { kind: 'wrongGuess', pid: 'p1', text: 'sapatos' },
      { kind: 'reaction', pid: 'p1', emoji: '😂' },
      { kind: 'hint' },
      { kind: 'turnEnd', reason: 'time' },
      { kind: 'rejoined', pid: 'p1' },
      { kind: 'wordsReshuffled' },
      { kind: 'notEnoughPlayers' },
    ];
    expect(silent.map(soundForFx)).toEqual(silent.map(() => null));
  });
});

describe('transitionSounds', () => {
  it('plays nothing for the first snapshot, whatever its phase', () => {
    expect(transitionSounds(null, s('CHOOSING', 3))).toEqual([]);
    expect(transitionSounds(null, s('REVEAL', 3, 'time'))).toEqual([]);
    expect(transitionSounds(null, s('FINAL'))).toEqual([]);
  });

  it('chimes "your turn" for a new turn: the first deal, the next one, and a word chosen ahead', () => {
    const chime = [{ name: 'yourTurn', delayMs: 0 }];
    expect(transitionSounds(s('LOBBY'), s('CHOOSING', 1))).toEqual(chime);
    expect(transitionSounds(s('REVEAL', 1, 'time'), s('CHOOSING', 2))).toEqual(chime);
    expect(transitionSounds(s('REVEAL', 1, 'skip'), s('DRAWING', 2))).toEqual(chime);
    expect(transitionSounds(s('SCOREBOARD', 4), s('CHOOSING', 5))).toEqual(chime);
    expect(transitionSounds(s('FINAL', 6), s('CHOOSING', 7))).toEqual(chime);
  });

  it('does not chime again within a turn', () => {
    expect(transitionSounds(s('CHOOSING', 2), s('DRAWING', 2))).toEqual([]);
    expect(transitionSounds(s('DRAWING', 2), s('DRAWING', 2))).toEqual([]);
  });

  it('plays the sting on the reveal, after the time-up sound when the clock ran out', () => {
    expect(transitionSounds(s('DRAWING', 2), s('REVEAL', 2, 'time'))).toEqual([
      { name: 'timeUp', delayMs: 0 },
      { name: 'reveal', delayMs: STING_AFTER_TIME_UP_MS },
    ]);
    for (const reason of ['allGuessed', 'skip', 'drawerGone'] as const) {
      expect(transitionSounds(s('DRAWING', 2), s('REVEAL', 2, reason))).toEqual([
        { name: 'reveal', delayMs: 0 },
      ]);
    }
    expect(transitionSounds(s('CHOOSING', 2), s('REVEAL', 2, 'skip'))).toEqual([
      { name: 'reveal', delayMs: 0 },
    ]);
  });

  it('plays nothing more while the reveal stays up', () => {
    expect(transitionSounds(s('REVEAL', 2, 'time'), s('REVEAL', 2, 'time'))).toEqual([]);
  });

  it('plays the fanfare on entering FINAL, from a reveal or an ended game, and only once', () => {
    const fanfare = [{ name: 'fanfare', delayMs: 0 }];
    expect(transitionSounds(s('REVEAL', 6, 'time'), s('FINAL', 6, 'time'))).toEqual(fanfare);
    expect(transitionSounds(s('DRAWING', 3), s('FINAL', 3, 'end'))).toEqual(fanfare);
    expect(transitionSounds(s('FINAL', 6), s('FINAL', 6))).toEqual([]);
  });

  it('a game going back to the lobby is silent', () => {
    expect(transitionSounds(s('FINAL', 6), s('LOBBY'))).toEqual([]);
  });
});

describe('nextTick', () => {
  it('ticks at each whole second from 10 down to 1', () => {
    expect(nextTick(25_000, 11)).toEqual({ second: 10, inMs: 15_000 });
    expect(nextTick(10_000, 11)).toEqual({ second: 10, inMs: 0 });
    expect(nextTick(10_000, 10)).toEqual({ second: 9, inMs: 1000 });
    expect(nextTick(1_000, 2)).toEqual({ second: 1, inMs: 0 });
    expect(nextTick(1_000, 1)).toBeNull();
    expect(nextTick(400, 11)).toBeNull();
  });

  it('skips a tick already past instead of playing it late', () => {
    expect(nextTick(9_500, 11)).toEqual({ second: 9, inMs: 500 });
  });

  it('never ticks a second twice after a resync', () => {
    // A new snapshot arrives just after the 7 s tick, with the clock reading a little more.
    expect(nextTick(7_020, 7)).toEqual({ second: 6, inMs: 1020 });
  });
});

describe('playing', () => {
  it('every sound has a file in client/public/sounds', () => {
    for (const name of SOUND_NAMES) {
      const file = fileURLToPath(new URL(`../../public${soundUrl(name)}`, import.meta.url));
      expect(existsSync(file), file).toBe(true);
    }
  });

  it('plays nothing before startSounds, then each sound by name', async () => {
    playSound('join');
    expect(howler.created).toHaveLength(0);
    await startSounds();
    expect(howler.created).toHaveLength(SOUND_NAMES.length);
    playSound('reveal');
    expect(howlFor('reveal').play).toHaveBeenCalledTimes(1);
    expect(howlFor('join').play).not.toHaveBeenCalled();
  });

  it('unlocks a suspended audio context inside the start', async () => {
    await startSounds();
    expect(howler.ctx.resume).toHaveBeenCalledTimes(1);
    expect(howler.silences.started).toBe(1);
  });

  it('with Howler preloaded, unlocks within the tap itself, before anything awaits', async () => {
    preloadSounds();
    await vi.dynamicImportSettled();
    void startSounds();
    expect(howler.created).toHaveLength(SOUND_NAMES.length);
    expect(howler.ctx.resume).toHaveBeenCalledTimes(1);
    expect(howler.silences.started).toBe(1);
  });

  it('any later tap or key unlocks again while audio is not running, and not once it is', async () => {
    await startSounds();
    howler.ctx.resume.mockClear();
    // An iOS interruption, or a start tap that came before Howler arrived.
    howler.ctx.state = 'interrupted';
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(howler.ctx.resume).toHaveBeenCalledTimes(2);
    howler.ctx.state = 'running';
    window.dispatchEvent(new Event('touchend'));
    expect(howler.ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('keeps the context awake through a long quiet turn', async () => {
    await startSounds();
    expect(howler.global.autoSuspend).toBe(false);
  });

  it('plays through the iOS ringer switch', async () => {
    const audioSession = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession });
    await startSounds();
    expect(audioSession.type).toBe('playback');
  });

  it('drops a tick whose file is still loading rather than playing it late', async () => {
    howler.loaded = false;
    await startSounds();
    playSound('tick');
    playSound('yourTurn');
    expect(howlFor('tick').play).not.toHaveBeenCalled();
    expect(howlFor('yourTurn').play).toHaveBeenCalledTimes(1);
  });

  it('applies the stored level before any sound exists, and every change after', async () => {
    saveSoundLevel('quiet');
    await startSounds();
    expect(howler.volume).toHaveBeenNthCalledWith(1, 0.4);
    expect(howler.volume.mock.results[0]!.value).toBe(0);
    saveSoundLevel('muted');
    expect(howler.volume).toHaveBeenLastCalledWith(0);
    saveSoundLevel('on');
    expect(howler.volume).toHaveBeenLastCalledWith(1);
  });

  it('starts once, however often it is called', async () => {
    await startSounds();
    await startSounds();
    expect(howler.created).toHaveLength(SOUND_NAMES.length);
  });

  it('stays silent, without throwing, when audio fails', async () => {
    howler.fail = true;
    await expect(startSounds()).resolves.toBeUndefined();
    expect(() => playSound('correct')).not.toThrow();
  });
});

describe('soundPref', () => {
  it('keeps the level across a reload', () => {
    saveSoundLevel('quiet');
    resetSoundLevel();
    expect(loadSoundLevel()).toBe('quiet');
  });

  it('keeps the level in memory when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    saveSoundLevel('muted');
    expect(loadSoundLevel()).toBe('muted');
  });
});

describe('createScreenSounds', () => {
  let played: string[] = [];
  // The fake timers move `Date.now()` with them, so a tick's callback reads the clock at its time.
  const make = () => createScreenSounds((name) => played.push(name), Date.now);
  const drawing = (turnId: number, remainingMs: number, running = true): SoundInput => ({
    phase: 'DRAWING',
    turnId,
    endReason: null,
    timer: { remainingMs, totalMs: 60_000, running },
    receivedAt: Date.now(),
  });
  const advance = (ms: number) => vi.advanceTimersByTime(ms);

  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
    played = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks once a second over the last 10 s, then plays time-up and the sting at the reveal', () => {
    const sounds = make();
    sounds.update({ ...drawing(1, 15_000), phase: 'CHOOSING' });
    sounds.update(drawing(1, 15_000));
    advance(4_999);
    expect(played).toEqual([]);
    advance(1);
    expect(played).toEqual(['tick']);
    advance(9_000);
    expect(played).toEqual(Array(10).fill('tick'));
    advance(1_000);
    expect(played).toHaveLength(10);
    sounds.update({
      phase: 'REVEAL',
      turnId: 1,
      endReason: 'time',
      timer: null,
      receivedAt: Date.now(),
    });
    expect(played.slice(10)).toEqual(['timeUp']);
    advance(STING_AFTER_TIME_UP_MS);
    expect(played.slice(10)).toEqual(['timeUp', 'reveal']);
  });

  it('stops ticking while paused and picks up from the resumed clock', () => {
    const sounds = make();
    sounds.update(drawing(1, 30_000));
    sounds.update(drawing(1, 8_500));
    advance(500);
    expect(played).toEqual(['tick']); // 8 s
    sounds.update(drawing(1, 7_900, false));
    advance(30_000);
    expect(played).toEqual(['tick']);
    sounds.update(drawing(1, 7_900));
    advance(900);
    expect(played).toEqual(['tick', 'tick']); // 7 s
  });

  it('never ticks a second twice when a snapshot arrives mid-countdown', () => {
    const sounds = make();
    sounds.update(drawing(1, 30_000));
    sounds.update(drawing(1, 6_000));
    advance(0);
    expect(played).toEqual(['tick']); // 6 s, due now
    // A correct guess's snapshot reads the clock a little high.
    sounds.update(drawing(1, 6_020));
    advance(1_000);
    expect(played).toEqual(['tick']);
    advance(20);
    expect(played).toEqual(['tick', 'tick']); // 5 s
  });

  it('counts each turn from 10 again', () => {
    const sounds = make();
    sounds.update(drawing(1, 30_000));
    sounds.update(drawing(1, 3_000));
    advance(0);
    expect(played).toEqual(['tick']);
    sounds.update({ ...drawing(2, 10_000), phase: 'CHOOSING' });
    played = [];
    sounds.update(drawing(2, 10_000));
    advance(0);
    expect(played).toEqual(['tick']);
  });

  it('plays nothing for the first snapshot, and a chime for the next turn', () => {
    const sounds = make();
    sounds.update({ phase: 'REVEAL', turnId: 1, endReason: 'time', timer: null, receivedAt: 0 });
    advance(5_000);
    expect(played).toEqual([]);
    sounds.update({ ...drawing(2, 12_000), phase: 'CHOOSING' });
    expect(played).toEqual(['yourTurn']);
  });

  it('stop cancels a waiting sting and the next tick', () => {
    const sounds = make();
    sounds.update(drawing(1, 30_000));
    sounds.update({ phase: 'REVEAL', turnId: 1, endReason: 'time', timer: null, receivedAt: 0 });
    sounds.stop();
    advance(60_000);
    expect(played).toEqual(['timeUp']);
    sounds.update(drawing(2, 10_500));
    sounds.stop();
    advance(60_000);
    expect(played).toEqual(['timeUp', 'yourTurn']);
  });
});
