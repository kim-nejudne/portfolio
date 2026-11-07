import { useEffect, useRef, useState } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_CHOICES,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
} from '#shared/constants.js';
import { categoryOffered, levelCount, placeShortfall } from '#shared/placeCheck.js';
import type { CategorySummary, GameSettings, PlayerView } from '#shared/types.js';
import { NO_DESTINATIONS } from '../lib/format.js';
import type { GameSocket } from '../lib/socket.js';
import { initialSettings, saveVipSettings } from '../lib/vipSettings.js';

export type VipPlayerView = PlayerView & { vip: NonNullable<PlayerView['vip']> };

/** Search appears once there are more categories than this (spec: VIP controls). */
const SEARCH_FROM = 8;
const LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mixed: 'Mixed' } as const;
const NOUN = { name: 'cities', picture: 'landmarks' } as const;

interface Option<T> {
  value: T;
  label: string;
  /** Why it is unavailable; available when null. */
  reason: string | null;
}

/**
 * The VIP's lobby settings card (spec: VIP controls; DESIGN.md "VIP lobby"): category cards,
 * Mode, Difficulty, Rounds, Timer and Start ▶ with its disabled reason. Every tap sends
 * `vip:settings`; the card renders only the server's settings.
 */
export function VipLobby({ view, socket }: { view: VipPlayerView; socket: GameSocket | null }) {
  const { settings: s, vip } = view;
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const applied = useRef(false);
  const category = vip.categories.find((c) => c.id === s.categoryId);

  function send(partial: Partial<GameSettings>) {
    setError(null);
    socket?.emit('vip:settings', partial, (res) => {
      if (!res.ok) setError(res.error);
    });
  }

  // A room without a live category gets this device's remembered settings (or the defaults) once.
  useEffect(() => {
    if (applied.current || !socket || category || vip.categories.length === 0) return;
    applied.current = true;
    send(initialSettings(vip.categories));
  });

  // Remember what the VIP last played with, once it names a live category.
  useEffect(() => {
    if (category) saveVipSettings(s);
  }, [category, s]);

  const shortfall = (difficulty: GameSettings['difficulty'], rounds: GameSettings['rounds']) =>
    category ? placeShortfall(category, s.mode, difficulty, rounds) : null;
  const startReason = !view.hasCategories
    ? NO_DESTINATIONS
    : vip.screenCount === 0
      ? 'Open the Screen first'
      : !category
        ? 'Pick a category'
        : shortfall(s.difficulty, s.rounds);

  const q = query.trim().toLowerCase();
  const shown = vip.categories.filter((c) => c.name.toLowerCase().includes(q));

  return (
    <section
      aria-label="Game settings"
      className="flex flex-col gap-5 rounded-card border border-line bg-board-panel p-4"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">Category</legend>
        {vip.categories.length === 0 ? (
          <p className="text-text-dim">{NO_DESTINATIONS}</p>
        ) : (
          <>
            {vip.categories.length > SEARCH_FROM && (
              <input
                type="search"
                aria-label="Search categories"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full rounded-button border border-line bg-board-bg px-4 text-text placeholder:text-text-dim"
              />
            )}
            <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              {shown.map((c) => (
                <li key={c.id}>
                  <CategoryCard
                    category={c}
                    mode={s.mode}
                    selected={c.id === s.categoryId}
                    onPick={() => send({ categoryId: c.id })}
                  />
                </li>
              ))}
            </ul>
            {shown.length === 0 && <p className="text-text-dim">No category matches</p>}
          </>
        )}
      </fieldset>

      <Segmented
        legend="Mode"
        value={s.mode}
        onChange={(mode) => send({ mode })}
        options={[
          { value: 'name', label: 'Name', reason: null },
          { value: 'picture', label: 'Picture', reason: null },
        ]}
      />
      <Segmented
        legend="Difficulty"
        value={s.difficulty}
        onChange={(difficulty) => send({ difficulty })}
        options={DIFFICULTY_CHOICES.map((d) => ({
          value: d,
          label: LABEL[d],
          reason: shortfall(d, ROUND_OPTIONS[0]),
        }))}
      />
      <Segmented
        legend="Rounds"
        value={s.rounds}
        onChange={(rounds) => send({ rounds })}
        options={ROUND_OPTIONS.map((r) => ({
          value: r,
          label: String(r),
          reason: shortfall(s.difficulty, r),
        }))}
      />
      <Segmented
        legend="Timer"
        value={s.timerSeconds}
        onChange={(timerSeconds) => send({ timerSeconds })}
        options={TIMER_OPTIONS.map((t) => ({ value: t, label: `${t} s`, reason: null }))}
      />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={startReason !== null}
          aria-describedby={startReason ? 'start-reason' : undefined}
          onClick={() =>
            socket?.emit('vip:start', {}, (res) => {
              if (!res.ok) setError(res.error);
            })
          }
          className="min-h-12 w-full rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
        >
          Start ▶
        </button>
        {startReason && (
          <p id="start-reason" className="text-text-dim">
            {startReason}
          </p>
        )}
        {error && (
          <p role="alert" className="text-delayed">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function CategoryCard({
  category: c,
  mode,
  selected,
  onPick,
}: {
  category: CategorySummary;
  mode: GameSettings['mode'];
  selected: boolean;
  onPick: () => void;
}) {
  const offered = categoryOffered(c, mode);
  const counts = DIFFICULTIES.map((l) => `${LABEL[l]} ${levelCount(c, mode, l)}`).join(' · ');
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!offered}
      onClick={onPick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-card border-2 bg-board-bg p-3 text-left active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100 ${selected ? 'border-amber' : 'border-line'}`}
    >
      <span aria-hidden="true" className="text-[32px]">
        {c.emoji ?? '🗺️'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold">{c.name}</span>
        <span className="text-sm text-text-dim">
          {offered ? counts : `Not enough ${NOUN[mode]} yet`}
        </span>
      </span>
    </button>
  );
}

/** DESIGN.md "Segmented control": unavailable options are dimmed, disabled, with reasons under. */
export function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  disabled = false,
}: {
  legend: string;
  options: Option<T>[];
  /** Every option, while a change is being sent. */
  disabled?: boolean;
  value: T;
  onChange: (value: T) => void;
}) {
  const reasons = [...new Set(options.flatMap((o) => (o.reason ? [o.reason] : [])))];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="flex rounded-button bg-board-bg p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            disabled={disabled || o.reason !== null}
            onClick={() => onChange(o.value)}
            className={`min-h-12 flex-1 rounded-button px-2 font-semibold ${o.value !== value ? 'text-text-dim disabled:opacity-50' : o.reason ? 'border border-amber-dim text-text-dim' : 'bg-amber text-board-bg'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {reasons.map((r) => (
        <p key={r} className="text-sm text-text-dim">
          {r}
        </p>
      ))}
    </fieldset>
  );
}
