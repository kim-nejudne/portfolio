// `/dev/bots/:code`: spawn simulated players so one person can test a full game on one computer.
// App.tsx registers this route only in development builds (Dev tool: fake players).

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { MAX_PLAYERS_PER_ROOM } from '../../../shared/constants.js';
import { isCompleteRoomCode } from '../lib/roomCode.js';
import type { GameSocket } from '../lib/socket.js';
import {
  BOT_BUZZ_MAX_DELAY_MS,
  DEFAULT_BOT_COUNT,
  botId,
  botName,
  buzzDelay,
  clampBotCount,
  createBot,
  type Bot,
  type BotState,
} from './bots.js';

interface DevBotsProps {
  makeSocket?: () => GameSocket;
  random?: () => number;
}

export default function DevBots({ makeSocket, random }: DevBotsProps) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!isCompleteRoomCode(code)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="font-display text-4xl text-accent">Not a room code</h1>
        <Link to="/" className="text-lg underline underline-offset-4">
          Back to start
        </Link>
      </main>
    );
  }
  // Keyed by code, so another room starts with no bots and the old room's bots disconnect.
  return <BotPanel key={code} code={code} makeSocket={makeSocket} random={random} />;
}

function BotPanel({ code, makeSocket, random = Math.random }: DevBotsProps & { code: string }) {
  const bots = useRef<Bot[]>([]);
  const [states, setStates] = useState<BotState[]>([]);
  const [count, setCount] = useState(String(DEFAULT_BOT_COUNT));

  const onChange = (next: BotState) =>
    setStates((prev) => prev.map((s) => (s.id === next.id ? next : s)));

  /** Grows or shrinks the bot set to `n`. Bot k always has the same id, so it rejoins as itself. */
  function resize(n: number) {
    for (const bot of bots.current.slice(n)) bot.disconnect();
    const from = Math.min(n, bots.current.length) + 1;
    const indexes = Array.from({ length: Math.max(0, n - from + 1) }, (_, i) => from + i);
    // Rows exist before the bots, so an ack that lands at once has a row to update.
    setStates((prev) => [
      ...prev.slice(0, n),
      ...indexes.map((index): BotState => ({
        id: botId(index),
        name: botName(index),
        status: 'connecting',
        message: null,
        rttMs: null,
      })),
    ]);
    bots.current = [
      ...bots.current.slice(0, n),
      ...indexes.map((index) => createBot({ code, index, onChange, makeSocket })),
    ];
  }

  function buzzAll() {
    for (const bot of bots.current) bot.buzz(buzzDelay(random));
  }

  useEffect(
    () => () => {
      for (const bot of bots.current) bot.disconnect();
      bots.current = [];
    },
    [],
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-4xl text-accent">Bots for {code}</h1>
      <p className="text-muted">
        Development only. Each bot is a real player socket that pings the server.
      </p>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          resize(clampBotCount(count));
        }}
      >
        <label className="flex flex-col gap-1">
          <span>Number of bots</span>
          <input
            type="number"
            min={1}
            max={MAX_PLAYERS_PER_ROOM}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-28 rounded-lg bg-surface px-3 py-2 text-lg"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink"
        >
          Spawn
        </button>
        <button
          type="button"
          disabled={states.length === 0}
          onClick={() => resize(0)}
          className="rounded-lg bg-surface px-4 py-2 disabled:opacity-50"
        >
          Remove all
        </button>
        <button
          type="button"
          disabled={states.length === 0}
          onClick={buzzAll}
          className="rounded-lg bg-surface px-4 py-2 disabled:opacity-50"
        >
          Buzz all (random 0–{BOT_BUZZ_MAX_DELAY_MS} ms)
        </button>
      </form>

      <ul aria-label="Bots" className="flex flex-col gap-1">
        {states.map((bot) => (
          <li key={bot.id} className="flex gap-3 rounded-lg bg-surface px-3 py-2">
            <span className="w-20 font-semibold">{bot.name}</span>
            <span className="w-24">{bot.status}</span>
            <span className="w-20 text-muted">{bot.rttMs === null ? '—' : `${bot.rttMs} ms`}</span>
            <span className="flex-1 text-muted">{bot.message}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
