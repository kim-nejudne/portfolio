// Simulated players for `/dev/bots/:code` (Dev tool: fake players). Development builds only.
// Adapted from Buzzr (buzzer/client/src/dev/bots.ts): a bot is a real player socket that joins
// through `player:join` like a phone. It guesses random decoy words, guesses right on demand with
// the word from the dev-only `GET /api/dev/rooms/:code/word`, and draws a scripted doodle over its
// own `/ink` socket when it is the drawer. It reads only its role-filtered `state`.

import { DEFAULT_INK_SIZE, MAX_PLAYERS, PLAYER_KEY_LENGTH } from '../../../shared/constants.js';
import type { Ack, DevWordResponse, InkAuth, InkBatch, PlayerView } from '../../../shared/types.js';
import { createInkSender, type InkSender } from '../ink/inkSender.js';
import { keepPinging } from '../lib/ping.js';
import { createInkSocket, createSocket, type GameSocket, type InkSocket } from '../lib/socket.js';
import { doodleSteps } from './doodle.js';

export const DEFAULT_BOT_COUNT = 3;
/** Auto-guessing bots send a wrong guess every BOT_GUESS_MIN_MS…BOT_GUESS_MAX_MS. */
export const BOT_GUESS_MIN_MS = 3000;
export const BOT_GUESS_MAX_MS = 8000;
/** One doodle step (a pen move) per tick: the doodle takes a few seconds, like a quick sketch. */
export const DOODLE_STEP_MS = 20;
/** A drawing bot takes this long to pick one of its three words (the auto-pick is 12 s). */
export const BOT_CHOOSE_MS = 1500;
/** Socket.IO acks never time out by themselves. */
export const BOT_ACK_TIMEOUT_MS = 5000;
const PEN_COLOR = 0;

/**
 * Wrong-on-purpose guesses: everyday Tagalog words nobody could draw, so none is a pack word or
 * close to one (`bots.test.ts` checks the shipped packs).
 */
export const DECOY_WORDS = [
  'kahapon',
  'bukas',
  'ngayon',
  'siguro',
  'talaga',
  'palagi',
  'minsan',
  'kanina',
  'mamaya',
  'pwede',
  'ganito',
  'ganyan',
  'sobra',
  'medyo',
  'grabe',
] as const;

/** The count input as a whole number of bots in [1, MAX_PLAYERS]; junk falls back to 1. */
export function clampBotCount(raw: string): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) ? Math.min(MAX_PLAYERS, Math.max(1, n)) : 1;
}

export const botName = (index: number) => `Bot ${index}`;

/** Bot k's fixed player key, so a re-spawn rejoins as the same player. */
export function botKey(index: number): string {
  const prefix = 'sketchy-dev-bot-';
  return prefix + String(index).padStart(PLAYER_KEY_LENGTH - prefix.length, '0');
}

export type BotStatus = 'connecting' | 'joined' | 'error' | 'offline';

export interface BotState {
  index: number;
  name: string;
  status: BotStatus;
  /** From the latest `state`: drawing, guessing, or neither (lobby, reveal, scores). */
  role: 'drawer' | 'guesser' | null;
  guessed: boolean;
  /** The last error or action, never the word. */
  message: string | null;
}

export interface BotBehaviour {
  autoGuess: boolean;
  autoDraw: boolean;
}

export interface Bot {
  readonly index: number;
  /** Sends one decoy guess, if this bot may guess now. */
  guessRandom(): void;
  /** Fetches the current word from the dev endpoint and guesses it. */
  guessRight(): Promise<void>;
  /** Draws the scripted doodle, if this bot is drawing now. */
  draw(): void;
  /** `player:leave`, then closes both sockets. */
  leave(): void;
  /** Closes both sockets; the player stays in the room as disconnected. */
  disconnect(): void;
}

export interface BotOptions {
  code: string;
  /** 1-based. The key and name come from it. */
  index: number;
  onChange: (state: BotState) => void;
  /** Read on every `state`, so the panel's toggles apply at once. */
  behaviour: () => BotBehaviour;
  makeSocket?: () => GameSocket;
  makeInkSocket?: (auth: InkAuth) => InkSocket;
  fetchWord?: (code: string) => Promise<DevWordResponse>;
  random?: () => number;
}

export async function fetchDevWord(code: string): Promise<DevWordResponse> {
  const res = await fetch(`/api/dev/rooms/${encodeURIComponent(code)}/word`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as DevWordResponse;
}

export function createBot({
  code,
  index,
  onChange,
  behaviour,
  makeSocket = createSocket,
  makeInkSocket = createInkSocket,
  fetchWord = fetchDevWord,
  random = Math.random,
}: BotOptions): Bot {
  const playerKey = botKey(index);
  const socket = makeSocket();
  let ink: InkSocket | null = null;
  let view: PlayerView | null = null;
  let closed = false;
  let guessTimer: ReturnType<typeof setTimeout> | null = null;
  let doodle: { turnId: number; sender: InkSender; timer: ReturnType<typeof setTimeout> } | null =
    null;
  let drewTurn = -1;
  let choseTurn = -1;
  let chooseTimer: ReturnType<typeof setTimeout> | null = null;
  let state: BotState = {
    index,
    name: botName(index),
    status: 'connecting',
    role: null,
    guessed: false,
    message: null,
  };

  const update = (patch: Partial<BotState>) => {
    if (closed) return;
    state = { ...state, ...patch };
    onChange(state);
  };

  /** Calls `onAck` once: with the server's answer, or with `null` after BOT_ACK_TIMEOUT_MS. */
  const withTimeout = (onAck: (res: Ack | null) => void) => {
    let settled = false;
    const timer = setTimeout(() => settle(null), BOT_ACK_TIMEOUT_MS);
    function settle(res: Ack | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!closed) onAck(res);
    }
    return (res: Ack) => settle(res);
  };

  const isDrawer = (v: PlayerView | null, turnId?: number) =>
    v?.phase === 'DRAWING' &&
    v.turn?.drawerPid === v.me.pid &&
    (turnId === undefined || v.turn.id === turnId);
  const hasGuessed = (v: PlayerView) => v.players.some((p) => p.pid === v.me.pid && p.guessed);
  const mayGuess = (v: PlayerView | null): v is PlayerView =>
    v?.phase === 'DRAWING' &&
    v.paused === null &&
    v.turn !== null &&
    v.turn.drawerPid !== v.me.pid &&
    !hasGuessed(v);

  const join = () => {
    socket.emit(
      'player:join',
      { code, playerKey, name: state.name },
      withTimeout((res) => {
        if (res === null) {
          update({ status: 'error', message: 'No reply' });
          if (socket.connected) join();
          return;
        }
        if (!res.ok) return update({ status: 'error', message: res.error });
        update({ status: 'joined', message: null });
        // Like a phone: `/ink` connects only once the join went through.
        ink ??= makeInkSocket({ code, playerKey });
        if (!ink.connected) ink.connect();
      }),
    );
  };

  const sendGuess = (text: string, label: string) => {
    socket.emit(
      'player:guess',
      { text },
      withTimeout((res) => {
        if (res === null) update({ message: 'No reply' });
        else if (!res.ok) update({ message: res.error });
        else update({ message: label });
      }),
    );
  };

  const guessRandom = () => {
    if (!mayGuess(view)) return update({ message: 'Not guessing now' });
    const word = DECOY_WORDS[Math.floor(random() * DECOY_WORDS.length)] ?? DECOY_WORDS[0];
    sendGuess(word, `Guessed "${word}"`);
  };

  const stopGuessing = () => {
    if (guessTimer) clearTimeout(guessTimer);
    guessTimer = null;
  };

  const scheduleGuess = () => {
    if (guessTimer || closed) return;
    const delay = BOT_GUESS_MIN_MS + Math.round(random() * (BOT_GUESS_MAX_MS - BOT_GUESS_MIN_MS));
    guessTimer = setTimeout(() => {
      guessTimer = null;
      if (!behaviour().autoGuess || !mayGuess(view)) return;
      guessRandom();
      scheduleGuess();
    }, delay);
  };

  /** A drawing bot picks a random one of its three words after BOT_CHOOSE_MS. */
  const choose = (turnId: number) => {
    choseTurn = turnId;
    update({ message: 'Choosing a word…' });
    chooseTimer = setTimeout(() => {
      chooseTimer = null;
      const v = view;
      if (v?.phase !== 'CHOOSING' || v.turn?.id !== turnId || !v.secret?.choices) return;
      const index = Math.min(2, Math.floor(random() * 3)) as 0 | 1 | 2;
      socket.emit(
        'drawer:choose',
        { index },
        withTimeout((res) => {
          if (res === null) update({ message: 'No reply' });
          else if (!res.ok) update({ message: res.error });
          else update({ message: 'Chose a word' });
        }),
      );
    }, BOT_CHOOSE_MS);
  };

  const stopDoodle = () => {
    if (!doodle) return;
    clearTimeout(doodle.timer);
    doodle.sender.dispose();
    doodle = null;
  };

  const draw = () => {
    if (!isDrawer(view) || !view?.turn) return update({ message: 'Not drawing now' });
    const turnId = view.turn.id;
    stopDoodle();
    drewTurn = turnId;
    const sender = createInkSender({
      turnId,
      // Dropped while `/ink` is down, as on a phone.
      send: (batch: InkBatch) => {
        if (ink?.connected) ink.emit('ink:batch', batch);
      },
    });
    const steps = doodleSteps();
    let i = 0;
    const tick = () => {
      if (!doodle) return;
      if (!isDrawer(view, turnId)) return stopDoodle();
      // Paused: hold the pen until the turn resumes.
      if (view?.paused === null) {
        const step = steps[i++]!;
        if (step.kind === 'begin') sender.begin(PEN_COLOR, DEFAULT_INK_SIZE, step.x, step.y);
        else if (step.kind === 'move') sender.move(step.x, step.y);
        else sender.end();
        if (i >= steps.length) {
          stopDoodle();
          return update({ message: 'Drew the doodle' });
        }
      }
      doodle.timer = setTimeout(tick, DOODLE_STEP_MS);
    };
    doodle = { turnId, sender, timer: setTimeout(tick, DOODLE_STEP_MS) };
    update({ message: 'Drawing…' });
  };

  socket.on('connect', join);
  socket.on('disconnect', () => update({ status: 'offline' }));
  socket.on('state', (v) => {
    if (v.role !== 'player') return;
    view = v;
    const role =
      !v.turn || (v.phase !== 'CHOOSING' && v.phase !== 'DRAWING')
        ? null
        : v.turn.drawerPid === v.me.pid
          ? 'drawer'
          : 'guesser';
    if (role !== state.role || hasGuessed(v) !== state.guessed) {
      update({ role, guessed: hasGuessed(v) });
    }
    if (doodle && !isDrawer(v, doodle.turnId)) stopDoodle();
    const { autoGuess, autoDraw } = behaviour();
    if (autoGuess && mayGuess(v)) scheduleGuess();
    else stopGuessing();
    if (autoDraw && isDrawer(v) && v.turn && drewTurn !== v.turn.id) draw();
    if (
      autoDraw &&
      v.phase === 'CHOOSING' &&
      v.turn?.drawerPid === v.me.pid &&
      v.secret?.choices &&
      choseTurn !== v.turn.id
    )
      choose(v.turn.id);
  });
  socket.on('fx', (fx) => {
    if (fx.kind === 'correct' && fx.pid === view?.me.pid)
      update({ message: `Got it! +${fx.points}` });
  });
  socket.on('kicked', () => update({ status: 'error', message: 'Kicked' }));
  socket.on('room:closed', () => update({ status: 'offline', message: 'Game ended' }));

  // Like a phone, so a bot's guesses are latency-corrected too.
  const stopPinging = keepPinging(socket);
  socket.connect();

  const disconnect = () => {
    stopPinging();
    stopGuessing();
    if (chooseTimer) clearTimeout(chooseTimer);
    stopDoodle();
    closed = true;
    socket.removeAllListeners();
    socket.disconnect();
    ink?.disconnect();
  };

  return {
    index,
    guessRandom,
    async guessRight() {
      if (!mayGuess(view)) return update({ message: 'Not guessing now' });
      const turnId = view.turn?.id;
      let res: DevWordResponse;
      try {
        res = await fetchWord(code);
      } catch {
        return update({ message: 'Could not get the word' });
      }
      // The turn may have moved on while the word was on its way.
      if (
        res.word === null ||
        res.turnId !== turnId ||
        !mayGuess(view) ||
        view.turn?.id !== turnId
      ) {
        return update({ message: 'No word to guess' });
      }
      sendGuess(res.word, 'Guessed the word');
    },
    draw,
    leave() {
      socket.emit('player:leave', {}, () => {});
      disconnect();
    },
    disconnect,
  };
}
