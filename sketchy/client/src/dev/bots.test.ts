import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AVATARS,
  DEFAULT_SETTINGS,
  INK_FLUSH_MS,
  MAX_PLAYERS,
  PING_INTERVAL_MS,
  PLAYER_KEY_LENGTH,
} from '../../../shared/constants.js';
import { playerKeySchema } from '../../../shared/schemas.js';
import type {
  DevWordResponse,
  InkBatch,
  Phase,
  PlayerChipView,
  PlayerView,
} from '../../../shared/types.js';
import type { GameSocket, InkSocket } from '../lib/socket.js';
import {
  BOT_CHOOSE_MS,
  BOT_GUESS_MAX_MS,
  BOT_GUESS_MIN_MS,
  DECOY_WORDS,
  DOODLE_STEP_MS,
  botKey,
  botName,
  clampBotCount,
  createBot,
  type BotBehaviour,
  type BotState,
} from './bots.js';
import { doodleSteps } from './doodle.js';
import { FakeSocket } from './fakeSocket.js';

interface PackFile {
  words: { word: string; alt?: string[] }[];
}
/** Every shipped pack, so a new pack can't bring in a word a bot uses as a decoy. */
const SHIPPED_PACKS = Object.values(
  import.meta.glob<PackFile>('../../../data/packs/*.json', { eager: true, import: 'default' }),
);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const chip = (pid: string, extra: Partial<PlayerChipView> = {}): PlayerChipView => ({
  pid,
  name: pid,
  color: '#FF6B35',
  connected: true,
  crown: false,
  isDrawer: false,
  avatar: '🦊',
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
  ...extra,
});

/** A view for bot pid `me`, with `drawer` drawing turn `turnId`. */
function view(
  me: string,
  {
    phase = 'DRAWING',
    drawer = 'mika',
    turnId = 1,
    guessed = false,
    paused = false,
  }: { phase?: Phase; drawer?: string; turnId?: number; guessed?: boolean; paused?: boolean } = {},
): PlayerView {
  const inTurn = phase !== 'LOBBY';
  return {
    role: 'player',
    code: 'KPRW',
    phase,
    paused: paused ? { reasons: ['host'], resumeInMs: null } : null,
    rematchInMs: null,
    rematchFirst: null,
    gameNumber: 1,
    settings: { ...DEFAULT_SETTINGS },
    players: [chip('mika', { isDrawer: drawer === 'mika' }), chip(me, { guessed })],
    turn: inTurn
      ? {
          id: turnId,
          number: turnId,
          cycle: 1,
          drawerPid: drawer,
          drawerName: drawer,
          timer: null,
          mask: null,
          word: null,
          correct: [],
          guessed: { guessed: 0, of: 1 },
          endReason: null,
          drawerReconnecting: false,
        }
      : null,
    host: null,
    me: { pid: me, turnPoints: 0, score: null, rank: null, award: null },
    secret: null,
    lastGuess: null,
  };
}

interface SpawnOptions {
  behaviour?: Partial<BotBehaviour>;
  word?: DevWordResponse;
  random?: () => number;
}

function spawn(index = 2, { behaviour = {}, word, random = () => 0 }: SpawnOptions = {}) {
  const socket = new FakeSocket();
  const inks: FakeSocket[] = [];
  const states: BotState[] = [];
  const fetchWord = vi.fn(() => Promise.resolve(word ?? { turnId: 1, word: 'umbrella' }));
  const bot = createBot({
    code: 'KPRW',
    index,
    onChange: (s) => states.push(s),
    behaviour: () => ({ autoGuess: false, autoDraw: false, ...behaviour }),
    makeSocket: () => socket as unknown as GameSocket,
    makeInkSocket: (auth) => {
      const ink = new FakeSocket(auth);
      inks.push(ink);
      return ink as unknown as InkSocket;
    },
    fetchWord,
    random,
  });
  const joined = () => {
    socket.sent('player:join')[0]!.ack!({ ok: true });
  };
  const guesses = () =>
    socket.sent('player:guess').map((e) => (e.payload as { text: string }).text);
  const batches = () => inks[0]!.sent('ink:batch').map((e) => e.payload as InkBatch);
  return {
    bot,
    socket,
    inks,
    states,
    fetchWord,
    joined,
    guesses,
    batches,
    last: () => states.at(-1)!,
  };
}

describe('decoy guesses', () => {
  it('are never a word or alternate of a shipped pack, nor part of one', () => {
    expect(SHIPPED_PACKS.length).toBeGreaterThan(2);
    const forms = SHIPPED_PACKS.flatMap((p) =>
      p.words.flatMap((w) => [w.word, ...(w.alt ?? [])].map((f) => f.toLowerCase())),
    );
    for (const decoy of DECOY_WORDS)
      for (const form of forms)
        expect(form.includes(decoy) || decoy.includes(form), form).toBe(false);
  });
});

describe('bot helpers', () => {
  it('gives each bot a fixed, valid player key and name', () => {
    expect(botKey(3)).toHaveLength(PLAYER_KEY_LENGTH);
    expect(playerKeySchema.safeParse(botKey(3)).success).toBe(true);
    expect(botKey(3)).toBe(botKey(3));
    expect(botKey(3)).not.toBe(botKey(4));
    expect(botName(3)).toBe('Bot 3');
  });

  it('clamps the bot count to 1…MAX_PLAYERS', () => {
    expect(clampBotCount('3')).toBe(3);
    expect(clampBotCount('0')).toBe(1);
    expect(clampBotCount('99')).toBe(MAX_PLAYERS);
    expect(clampBotCount('abc')).toBe(1);
    expect(clampBotCount('2.7')).toBe(2);
  });
});

describe('createBot', () => {
  it('joins as a player on connect and opens /ink only after the join is accepted', () => {
    const { socket, inks, joined, last } = spawn(2);
    expect(socket.sent('player:join').map((e) => e.payload)).toEqual([
      { code: 'KPRW', playerKey: botKey(2), name: 'Bot 2', avatar: AVATARS[1] },
    ]);
    expect(inks).toHaveLength(0);
    joined();
    expect(last().status).toBe('joined');
    expect(inks).toHaveLength(1);
    expect(inks[0]!.auth).toEqual({ code: 'KPRW', playerKey: botKey(2) });
    expect(inks[0]!.connected).toBe(true);
  });

  it('shows a refused join as an error and opens no /ink socket', () => {
    const { socket, inks, last } = spawn();
    socket.sent('player:join')[0]!.ack!({ ok: false, error: 'roomFull' });
    expect(last()).toMatchObject({ status: 'error', message: 'roomFull' });
    expect(inks).toHaveLength(0);
  });

  it('pings every PING_INTERVAL_MS like a phone, and stops when removed', () => {
    const { bot, socket } = spawn();
    // One at once on connect, then one per interval.
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(socket.sent('ping')).toHaveLength(3);
    bot.disconnect();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(socket.sent('ping')).toHaveLength(3);
  });

  it('rejoins on every reconnect', () => {
    const { socket, joined } = spawn();
    joined();
    socket.fire('disconnect');
    socket.connect();
    expect(socket.sent('player:join')).toHaveLength(2);
  });

  it('guesses a random decoy word only as a guesser in DRAWING', () => {
    const { bot, socket, joined, guesses, last } = spawn(2, { random: () => 0 });
    joined();
    bot.guessRandom();
    expect(guesses()).toEqual([]);
    socket.fire('state', view('bot2', { phase: 'LOBBY' }));
    bot.guessRandom();
    expect(guesses()).toEqual([]);
    socket.fire('state', view('bot2'));
    bot.guessRandom();
    expect(guesses()).toEqual([DECOY_WORDS[0]]);
    expect(last().role).toBe('guesser');
    // A bot that already got it, or the drawer, never guesses.
    socket.fire('state', view('bot2', { guessed: true }));
    bot.guessRandom();
    socket.fire('state', view('bot2', { drawer: 'bot2' }));
    bot.guessRandom();
    expect(guesses()).toHaveLength(1);
  });

  it('reacts only once it got the word, or at the reveal (F34)', () => {
    const { bot, socket, joined } = spawn(2, { random: () => 0.2 });
    const reactions = () => socket.sent('player:react').map((e) => e.payload);
    joined();
    socket.fire('state', view('bot2'));
    bot.react();
    socket.fire('state', view('bot2', { guessed: true, paused: true }));
    bot.react();
    expect(reactions()).toEqual([]);
    socket.fire('state', view('bot2', { guessed: true }));
    bot.react();
    socket.fire('state', view('bot2', { phase: 'REVEAL' }));
    bot.react();
    expect(reactions()).toEqual([{ emoji: '🔥' }, { emoji: '🔥' }]);
  });

  it('guesses the word from the dev endpoint on demand, without showing it', async () => {
    const { bot, socket, joined, guesses, fetchWord, states } = spawn(2, {
      word: { turnId: 1, word: 'umbrella' },
    });
    joined();
    socket.fire('state', view('bot2'));
    await bot.guessRight();
    expect(fetchWord).toHaveBeenCalledWith('KPRW');
    expect(guesses()).toEqual(['umbrella']);
    expect(JSON.stringify(states)).not.toContain('umbrella');
  });

  it('does not guess right with a word for another turn or before there is one', async () => {
    const { bot, socket, joined, guesses } = spawn(2, { word: { turnId: 4, word: 'umbrella' } });
    joined();
    socket.fire('state', view('bot2', { turnId: 5 }));
    await bot.guessRight();
    expect(guesses()).toEqual([]);
  });

  it('auto-guesses every few seconds while it may guess, and stops once it got it', () => {
    const { socket, joined, guesses } = spawn(2, { behaviour: { autoGuess: true } });
    joined();
    socket.fire('state', view('bot2'));
    // random() = 0: the shortest gap.
    vi.advanceTimersByTime(BOT_GUESS_MIN_MS - 1);
    expect(guesses().length).toBe(0);
    vi.advanceTimersByTime(1);
    expect(guesses().length).toBe(1);
    vi.advanceTimersByTime(BOT_GUESS_MIN_MS);
    expect(guesses().length).toBe(2);
    socket.fire('state', view('bot2', { guessed: true }));
    vi.advanceTimersByTime(BOT_GUESS_MAX_MS * 3);
    expect(guesses().length).toBe(2);
  });

  it('draws the scripted doodle over /ink when it is the drawer, as one stroke set for the turn', () => {
    const { bot, socket, joined, batches } = spawn(2);
    joined();
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 7 }));
    bot.draw();
    vi.advanceTimersByTime(DOODLE_STEP_MS * (doodleSteps().length + 5));
    const sent = batches();
    expect(sent.length).toBeGreaterThan(1);
    expect(sent.every(([turnId]) => turnId === 7)).toBe(true);
    expect(sent.map(([, seq]) => seq)).toEqual(sent.map((_, i) => i + 1));
    const ops = sent.flatMap(([, , o]) => o);
    expect(ops.filter((op) => op[0] === 'b')).toHaveLength(4);
    expect(ops.filter((op) => op[0] === 'e')).toHaveLength(4);
  });

  it('picks one of its three words once per turn when auto-draw is on', () => {
    const { socket, joined } = spawn(2, { behaviour: { autoDraw: true }, random: () => 0.7 });
    joined();
    const choosing = (): PlayerView => ({
      ...view('bot2', { phase: 'CHOOSING', drawer: 'bot2', turnId: 4 }),
      secret: {
        turnId: 4,
        choices: [
          { word: 'apple', gloss: null, difficulty: 1, custom: false },
          { word: 'guitar', gloss: null, difficulty: 2, custom: false },
          { word: 'astronaut', gloss: null, difficulty: 3, custom: false },
        ],
        word: null,
        chooseTimer: null,
      },
    });
    socket.fire('state', choosing());
    socket.fire('state', choosing());
    vi.advanceTimersByTime(BOT_CHOOSE_MS - 1);
    expect(socket.sent('drawer:choose')).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(socket.sent('drawer:choose').map((e) => e.payload)).toEqual([{ index: 2 }]);
  });

  it('picks its word as the next drawer during REVEAL (F21)', () => {
    const { socket, joined } = spawn(2, { behaviour: { autoDraw: true }, random: () => 0 });
    joined();
    // Bot 1 drew turn 4; bot 2 was dealt turn 5.
    socket.fire('state', {
      ...view('bot2', { phase: 'REVEAL', drawer: 'bot1', turnId: 4 }),
      secret: {
        turnId: 5,
        choices: [
          { word: 'apple', gloss: null, difficulty: 1, custom: false },
          { word: 'guitar', gloss: null, difficulty: 2, custom: false },
          { word: 'astronaut', gloss: null, difficulty: 3, custom: false },
        ],
        word: null,
        chooseTimer: null,
      },
    });
    vi.advanceTimersByTime(BOT_CHOOSE_MS);
    expect(socket.sent('drawer:choose').map((e) => e.payload)).toEqual([{ index: 0 }]);
  });

  it('does not pick a word when auto-draw is off or it is not the drawer', () => {
    const { socket, joined } = spawn(2);
    joined();
    socket.fire('state', view('bot2', { phase: 'CHOOSING', drawer: 'bot2' }));
    const other = spawn(3, { behaviour: { autoDraw: true } });
    other.joined();
    other.socket.fire('state', view('bot3', { phase: 'CHOOSING' }));
    vi.advanceTimersByTime(BOT_CHOOSE_MS * 2);
    expect(socket.sent('drawer:choose')).toEqual([]);
    expect(other.socket.sent('drawer:choose')).toEqual([]);
  });

  it('never draws as a guesser', () => {
    const { bot, socket, joined, inks } = spawn(2);
    joined();
    socket.fire('state', view('bot2'));
    bot.draw();
    vi.advanceTimersByTime(5000);
    expect(inks[0]!.sent('ink:batch')).toEqual([]);
  });

  it('draws by itself once per turn when auto-draw is on', () => {
    const { socket, joined, batches } = spawn(2, { behaviour: { autoDraw: true } });
    joined();
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 3 }));
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 3 }));
    vi.advanceTimersByTime(DOODLE_STEP_MS * (doodleSteps().length + 5));
    const begins = batches()
      .flatMap(([, , o]) => o)
      .filter((op) => op[0] === 'b');
    expect(begins).toHaveLength(4);
  });

  it('stops drawing when the turn ends, and waits while paused', () => {
    const { bot, socket, joined, batches } = spawn(2);
    joined();
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 2 }));
    bot.draw();
    vi.advanceTimersByTime(DOODLE_STEP_MS * 5);
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 2, paused: true }));
    // What was drawn before the pause still goes out.
    vi.advanceTimersByTime(INK_FLUSH_MS);
    const whilePaused = batches().length;
    vi.advanceTimersByTime(DOODLE_STEP_MS * 50);
    expect(batches().length).toBe(whilePaused);
    socket.fire('state', view('bot2', { drawer: 'bot2', turnId: 2 }));
    vi.advanceTimersByTime(DOODLE_STEP_MS * 3 + INK_FLUSH_MS);
    const resumed = batches().length;
    expect(resumed).toBeGreaterThan(whilePaused);
    socket.fire('state', view('bot2', { phase: 'REVEAL', drawer: 'bot2', turnId: 2 }));
    vi.advanceTimersByTime(DOODLE_STEP_MS * 500);
    expect(batches().length).toBe(resumed);
  });

  it('leaves the room and closes both sockets when removed', () => {
    const { bot, socket, inks, joined } = spawn(2, { behaviour: { autoGuess: true } });
    joined();
    socket.fire('state', view('bot2'));
    bot.leave();
    expect(socket.sent('player:leave')).toHaveLength(1);
    expect(socket.disconnected).toBe(true);
    expect(inks[0]!.disconnected).toBe(true);
    vi.advanceTimersByTime(BOT_GUESS_MAX_MS * 3);
    expect(socket.sent('player:guess')).toEqual([]);
  });

  it('times out a join that gets no answer, and retries while connected', () => {
    const { socket, last } = spawn(2);
    vi.advanceTimersByTime(5000);
    expect(last()).toMatchObject({ status: 'error', message: 'No reply' });
    expect(socket.sent('player:join')).toHaveLength(2);
  });
});
