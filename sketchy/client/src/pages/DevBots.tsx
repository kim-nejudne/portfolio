// `/dev/bots/:code`: spawn fake players so one person can test a whole game on one computer
// (Dev tool: fake players). Adapted from Buzzr (buzzer/client/src/dev/DevBots.tsx). App.tsx
// registers this route only in development builds, and the page is its own lazy chunk.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from '../lib/router.js';
import { MAX_PLAYERS } from '../../../shared/constants.js';
import {
  DEFAULT_BOT_COUNT,
  botName,
  clampBotCount,
  createBot,
  type Bot,
  type BotBehaviour,
  type BotOptions,
  type BotState,
} from '../dev/bots.js';

const CODE_PATTERN = /^[A-Z]{4}$/;

type Injected = Pick<BotOptions, 'makeSocket' | 'makeInkSocket' | 'fetchWord' | 'random'>;

export default function DevBots(props: Injected) {
  const code = (useParams().code ?? '').toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return (
      <main className={`${page} max-w-md items-center justify-center text-center`}>
        <h1 className="text-4xl">Not a room code</h1>
        <Link to="/" className={`text-lg ${link}`}>
          Back to start
        </Link>
      </main>
    );
  }
  // Keyed by code, so another room starts with no bots and the old room's bots disconnect.
  return <BotPanel key={code} code={code} {...props} />;
}

// The sketchbook's tokens (F56), plainly: a dev tool, so no tape, rings or hand-drawn borders.
const page = 'mx-auto flex min-h-dvh flex-col gap-6 bg-paper px-4 font-hand text-ink';
const link = 'text-pen underline';
const control =
  'min-h-11 rounded-lg border-2 border-ink px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen disabled:opacity-60';
const button = `${control} bg-paper not-disabled:hover:bg-sticky`;
const primary = `${control} bg-hl`;

function BotPanel({ code, ...injected }: Injected & { code: string }) {
  const bots = useRef<Bot[]>([]);
  const [states, setStates] = useState<BotState[]>([]);
  const [count, setCount] = useState(String(DEFAULT_BOT_COUNT));
  const [behaviour, setBehaviour] = useState<BotBehaviour>({ autoGuess: true, autoDraw: true });
  const behaviourRef = useRef(behaviour);

  useEffect(() => {
    behaviourRef.current = behaviour;
  }, [behaviour]);

  const onChange = (next: BotState) =>
    setStates((prev) => prev.map((s) => (s.index === next.index ? next : s)));

  /** Grows or shrinks the bot set to `n`. Bot k always has the same key, so it rejoins as itself. */
  function resize(n: number) {
    for (const bot of bots.current.slice(n)) bot.leave();
    const from = Math.min(n, bots.current.length) + 1;
    const indexes = Array.from({ length: Math.max(0, n - from + 1) }, (_, i) => from + i);
    // Rows exist before the bots, so an ack that lands at once has a row to update.
    setStates((prev) => [
      ...prev.slice(0, n),
      ...indexes.map((index): BotState => ({
        index,
        name: botName(index),
        status: 'connecting',
        role: null,
        guessed: false,
        message: null,
      })),
    ]);
    bots.current = [
      ...bots.current.slice(0, n),
      ...indexes.map((index) =>
        createBot({ code, index, onChange, behaviour: () => behaviourRef.current, ...injected }),
      ),
    ];
  }

  useEffect(
    () => () => {
      for (const bot of bots.current) bot.disconnect();
      bots.current = [];
    },
    [],
  );

  const none = states.length === 0;
  function everyone(fn: (bot: Bot) => void) {
    for (const bot of bots.current) fn(bot);
  }

  return (
    <main className={`${page} max-w-3xl py-8`}>
      <header>
        <h1 className="text-4xl">Bots for {code}</h1>
        <p className="mt-1 text-soft">
          Development only. Each bot is a real player socket. Open the Screen at{' '}
          <Link to={`/screen/${code}`} className={link}>
            /screen/{code}
          </Link>
          .
        </p>
      </header>

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
            max={MAX_PLAYERS}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={`${control} w-28 bg-canvas font-num font-black`}
          />
        </label>
        <button type="submit" className={primary}>
          Spawn
        </button>
        <button type="button" disabled={none} onClick={() => resize(0)} className={button}>
          Remove all
        </button>
      </form>

      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Behaviour</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={behaviour.autoGuess}
            onChange={(e) => setBehaviour((b) => ({ ...b, autoGuess: e.target.checked }))}
            className="size-5 accent-pen focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen"
          />
          Guess random words by themselves
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={behaviour.autoDraw}
            onChange={(e) => setBehaviour((b) => ({ ...b, autoDraw: e.target.checked }))}
            className="size-5 accent-pen focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen"
          />
          Draw the doodle on their turn
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={none}
          onClick={() => everyone((b) => b.guessRandom())}
          className={button}
        >
          Everyone: random guess
        </button>
        <button
          type="button"
          disabled={none}
          onClick={() => everyone((b) => void b.guessRight())}
          className={button}
        >
          Everyone: guess right
        </button>
        <button
          type="button"
          disabled={none}
          onClick={() => everyone((b) => b.react())}
          className={button}
        >
          Everyone: react
        </button>
      </div>

      {none && <p className="text-soft">No bots yet. Spawn some above.</p>}
      <ul aria-label="Bots" className="flex flex-col gap-2">
        {states.map((s) => {
          const bot = () => bots.current.find((b) => b.index === s.index);
          return (
            <li
              key={s.index}
              className="flex flex-wrap items-center gap-3 border-b-2 border-dashed border-dot px-1 py-2"
            >
              <span className="w-16">{s.name}</span>
              <span className="w-24">{s.status}</span>
              <span className="w-24 text-soft">
                {s.role === 'drawer' ? '✏️ drawing' : s.guessed ? '✓ got it' : (s.role ?? '—')}
              </span>
              <span className="min-w-32 flex-1 text-soft">{s.message}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => bot()?.guessRandom()} className={button}>
                  Guess
                </button>
                <button type="button" onClick={() => void bot()?.guessRight()} className={button}>
                  Guess right
                </button>
                <button type="button" onClick={() => bot()?.draw()} className={button}>
                  Draw
                </button>
                <button type="button" onClick={() => bot()?.react()} className={button}>
                  React
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
