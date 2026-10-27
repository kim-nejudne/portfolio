// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PLAYERS_PER_ROOM, PING_INTERVAL_MS } from '../../../shared/constants.js';
import type { GameSocket } from '../lib/socket.js';
import { FakeSocket } from '../test/fakeSocket.js';
import {
  BOT_ACK_TIMEOUT_MS,
  BOT_BUZZ_MAX_DELAY_MS,
  buzzDelay,
  clampBotCount,
  createBot,
  type BotState,
} from './bots.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function spawn(index = 3) {
  const socket = new FakeSocket();
  const states: BotState[] = [];
  let now = 1000;
  const bot = createBot({
    code: 'ABCD',
    index,
    onChange: (s) => states.push(s),
    makeSocket: () => socket as unknown as GameSocket,
    clock: () => now,
  });
  const emits = (event: string) => socket.emitted.filter((e) => e.event === event);
  return {
    bot,
    socket,
    states,
    emits,
    last: () => states.at(-1),
    tick: (ms: number) => (now += ms),
  };
}

describe('createBot', () => {
  it('joins as a real player socket with an id and name fixed by its index', () => {
    const { emits, last } = spawn(3);
    const [join] = emits('player:join');
    expect(join!.payload).toEqual({ code: 'ABCD', playerId: 'bot-3', name: 'Bot 3' });

    join!.ack({ ok: true });
    expect(last()).toMatchObject({ id: 'bot-3', status: 'joined', message: null });
  });

  it('shows a refused join as an error', () => {
    const { emits, last } = spawn();
    emits('player:join')[0]!.ack({ ok: false, error: 'Room not found' });
    expect(last()).toMatchObject({ status: 'error', message: 'Room not found' });
  });

  it('rejoins on every reconnect and shows offline in between', () => {
    const { socket, emits, last } = spawn();
    socket.fire('disconnect');
    expect(last()!.status).toBe('offline');
    socket.fire('connect');
    expect(emits('player:join')).toHaveLength(2);
  });

  it('pings only while connected, with one interval across reconnects', () => {
    const { socket, emits } = spawn();
    socket.fire('disconnect');
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(emits('ping')).toHaveLength(0);

    socket.fire('connect');
    socket.fire('connect');
    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(emits('ping')).toHaveLength(1);
  });

  it('pings every PING_INTERVAL_MS and shows the round trip once a pong arrives', () => {
    const { socket, emits, last, tick } = spawn();
    vi.advanceTimersByTime(PING_INTERVAL_MS * 3);
    expect(emits('ping')).toHaveLength(3);

    const { t } = emits('ping')[2]!.payload as { t: number };
    tick(42);
    socket.fire('pong', { t }, () => {});
    expect(last()!.rttMs).toBe(42);
  });

  it('acks each pong, so the server can time its own RTT sample', () => {
    const { socket, emits } = spawn();
    vi.advanceTimersByTime(PING_INTERVAL_MS);
    const { t } = emits('ping')[0]!.payload as { t: number };
    let acked = 0;
    socket.fire('pong', { t }, () => acked++);
    expect(acked).toBe(1);
  });

  it('sends player:buzz only after the given delay and shows the ack', () => {
    const { bot, emits, last } = spawn();
    bot.buzz(120);
    vi.advanceTimersByTime(119);
    expect(emits('player:buzz')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    const [buzz] = emits('player:buzz');
    expect(buzz!.payload).toEqual({});

    buzz!.ack({ ok: false, error: 'Buzzers are not open' });
    expect(last()!.message).toBe('Buzzers are not open');
  });

  it('shows an error when a buzz gets no ack, as before the server handles player:buzz', () => {
    const { bot, emits, last } = spawn();
    bot.buzz(0);
    vi.advanceTimersByTime(BOT_ACK_TIMEOUT_MS);
    expect(last()!.message).toBe(`No reply in ${BOT_ACK_TIMEOUT_MS / 1000} s`);

    // A late ack does not overwrite the timeout.
    emits('player:buzz')[0]!.ack({ ok: true });
    expect(last()!.message).toBe(`No reply in ${BOT_ACK_TIMEOUT_MS / 1000} s`);
  });

  it('disconnect closes the socket, stops pinging and cancels pending buzzes', () => {
    const { bot, socket, emits, states } = spawn();
    bot.buzz(100);
    bot.disconnect();
    const updates = states.length;
    vi.advanceTimersByTime(PING_INTERVAL_MS * 5);

    expect(socket.disconnected).toBe(true);
    expect(emits('ping')).toHaveLength(0);
    expect(emits('player:buzz')).toHaveLength(0);
    expect(states).toHaveLength(updates);
  });
});

describe('buzzDelay', () => {
  it.each([
    [0, 0],
    [0.5, 150],
    [0.9999, BOT_BUZZ_MAX_DELAY_MS],
  ])('maps random %d to %d ms, within 0–300 ms', (random, ms) => {
    expect(buzzDelay(() => random)).toBe(ms);
  });
});

describe('clampBotCount', () => {
  it.each([
    ['8', 8],
    ['0', 1],
    ['', 1],
    ['abc', 1],
    ['7.9', 7],
    ['999', MAX_PLAYERS_PER_ROOM],
  ])('turns %j into %d bots', (raw, n) => {
    expect(clampBotCount(raw)).toBe(n);
  });
});
