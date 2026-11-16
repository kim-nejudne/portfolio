import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { DIFFICULTIES } from '../../../shared/constants.js';
import type { Difficulty, QuestionSet } from '../../../shared/types.js';
import {
  cardMeta,
  FIRST_LEVEL,
  keysOf,
  keyToPick,
  searchSections,
  type CategoryCard,
  type PickerItem,
  type PickerSections,
  type SetTile,
} from '../lib/categoryCards.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import { CHOICE_TILE, INPUT, LABEL, RULED } from '../lib/ui.js';
import { CategoryRow, LEVEL_WORD, LevelTile } from './CategoryRow.js';
import { Icon } from './Icon.js';

interface CategoryPickerProps {
  /** Prefixes the element ids and names the radios' group. */
  id: string;
  sections: PickerSections;
  /** The picked set's key (`hostableRows`'s `keyOf`). */
  selectedKey: string | null;
  /** Null when the search hides the picked set. */
  onSelect: (key: string | null) => void;
  /** A tile's line under its title. */
  detail: (set: QuestionSet) => string;
  disabled?: boolean;
  /** Adds **Build a game** as the last tile. The Screen never passes it (DECISIONS F57). */
  onBuild?: () => void;
  buildDisabled?: boolean;
  /** Shown at the top of Built-in: the built-ins failed to load, with Retry. */
  builtInError?: ReactNode;
}

/** Two columns on a phone, three once the picker has 36rem (a tablet, or beside the ticket). */
const GRID = 'grid grid-cols-2 gap-2.5 @xl:grid-cols-3 @xl:gap-3';

/**
 * **Host a game** and **New game**'s list (F131, F139): a search box, this browser's sets as tiles,
 * then a row per built-in category with an Easy / Medium / Hard tile each (`CategoryRow`, shared with
 * `/sets`), other built-ins as tiles, and **Build a game** last. Every level and tile is a native
 * radio of one group, so the arrow keys move between them; a click on a row's body picks the level
 * last chosen, or the nearest it has.
 */
export function CategoryPicker({
  id,
  sections,
  selectedKey,
  onSelect,
  detail,
  disabled = false,
  onBuild,
  buildDisabled = false,
  builtInError,
}: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  // The level a row's body picks: the last one chosen on a tile.
  const [lastLevel, setLastLevel] = useState<Difficulty>(FIRST_LEVEL);
  const shown = searchSections(sections, query);
  const items = [...shown.yours, ...shown.builtIn];
  const name = `${id}-set`;

  function search(next: string) {
    setQuery(next);
    // A pick the host can no longer see is not one they meant to start.
    const left = searchSections(sections, next);
    if (selectedKey !== null && ![...left.yours, ...left.builtIn].some(holds(selectedKey)))
      onSelect(null);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || items.length !== 1) return;
    event.preventDefault();
    onSelect(keyToPick(items[0]!, lastLevel));
  }

  function tile(item: SetTile) {
    return (
      <label key={item.key} className={`${CHOICE_TILE} group flex min-w-0 flex-col gap-1 p-3`}>
        <input
          type="radio"
          name={name}
          value={item.key}
          checked={item.key === selectedKey}
          onChange={() => onSelect(item.key)}
          aria-label={item.set.title}
          className="sr-only"
        />
        <span aria-hidden="true" className="mb-1 text-3xl leading-none">
          {item.emoji}
        </span>
        <span className="line-clamp-2 font-sans text-base leading-tight font-semibold break-words">
          {item.set.title}
        </span>
        <span className="font-outlier text-sm font-semibold text-muted group-has-checked:text-ink">
          {detail(item.set)}
        </span>
      </label>
    );
  }

  function row(item: CategoryCard) {
    // The row's body picks a level; a level's own tile picks itself.
    const pickBody = (event: MouseEvent) => {
      if (disabled || (event.target as Element).closest('label')) return;
      onSelect(keyToPick(item, lastLevel));
    };
    return (
      <CategoryRow
        key={item.id}
        headingId={`${id}-card-${item.id}`}
        emoji={item.emoji}
        name={item.name}
        meta={cardMeta(item)}
        onClick={pickBody}
      >
        <div className="grid grid-cols-[repeat(3,2.75rem)] gap-1.5 @2xl:grid-cols-3 @2xl:gap-2">
          {DIFFICULTIES.map((level) => {
            const keyed = item.levels[level];
            // A level the category lacks keeps its place, so the tiles line up across rows.
            if (!keyed)
              return (
                <span
                  key={level}
                  aria-hidden="true"
                  className="flex min-h-11 items-center justify-center rounded-control inset-ring-1 inset-ring-edge text-muted @2xl:justify-start @2xl:px-3"
                >
                  <span data-initial={DIFFICULTY_LABELS[level][0]} className={LEVEL_WORD}>
                    {DIFFICULTY_LABELS[level]}
                  </span>
                </span>
              );
            return (
              <LevelTile
                key={level}
                name={name}
                value={keyed.key}
                checked={keyed.key === selectedKey}
                onChange={() => {
                  setLastLevel(level);
                  onSelect(keyed.key);
                }}
                title={keyed.set.title}
                level={DIFFICULTY_LABELS[level]}
              />
            );
          })}
        </div>
      </CategoryRow>
    );
  }

  // Rows and tiles in the order given: each run of tiles shares one grid.
  const runs: PickerItem[][] = [];
  for (const item of shown.builtIn) {
    const last = runs.at(-1);
    if (last && last[0]!.kind === item.kind) last.push(item);
    else runs.push([item]);
  }
  const lastRun = runs.at(-1);
  const buildTile = onBuild && (
    <button
      type="button"
      onClick={onBuild}
      disabled={buildDisabled}
      aria-label="Build a game"
      aria-describedby={`${id}-build-hint`}
      className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-control border-2 border-ink p-4 text-center text-ink not-disabled:hover:hover-tint not-disabled:active:bg-bg-deep disabled:opacity-40"
    >
      <span aria-hidden="true" className="font-display text-3xl leading-none">
        +
      </span>
      <span className="font-outlier text-base font-semibold uppercase">Build a game</span>
      <span
        id={`${id}-build-hint`}
        className="max-w-[18ch] font-outlier text-sm font-semibold text-muted"
      >
        Mix categories or make a category board
      </span>
    </button>
  );
  // Build a game ends the last grid of tiles, or is a grid of its own after a row.
  const buildAlone = buildTile && lastRun?.[0]?.kind !== 'tile';

  return (
    // A container: the columns follow the room the picker has, not the window.
    <div className="@container flex min-w-0 flex-col gap-4">
      <label className="relative block">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
          <Icon name="search" className="size-5" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={onSearchKey}
          disabled={disabled}
          aria-label="Search sets"
          placeholder="Search categories or sets"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className={`${INPUT} py-2.5 pl-12 font-sans text-lg font-medium placeholder:text-muted disabled:opacity-40`}
        />
      </label>
      <fieldset
        disabled={disabled}
        className={`flex min-w-0 flex-col gap-6 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <legend className="sr-only">Question set</legend>
        {shown.yours.length > 0 && (
          <Section id={`${id}-yours`} title="Your sets" count={shown.yours.length}>
            <div className={GRID}>{shown.yours.map(tile)}</div>
          </Section>
        )}
        <Section id={`${id}-built-in`} title="Built-in" count={shown.builtIn.length}>
          {builtInError}
          {items.length === 0 && (
            <p role="status" className="py-2 text-center text-muted">
              No sets match.
            </p>
          )}
          {runs.map((run) =>
            run[0]!.kind === 'category' ? (
              <div key={keysOf(run[0]!)[0]} className={RULED}>
                {(run as CategoryCard[]).map(row)}
              </div>
            ) : (
              <div key={keysOf(run[0]!)[0]} className={GRID}>
                {(run as SetTile[]).map(tile)}
                {run === lastRun && buildTile}
              </div>
            ),
          )}
          {buildAlone && <div className={GRID}>{buildTile}</div>}
        </Section>
      </fieldset>
    </div>
  );
}

/** Whether an item holds the set with `key`. */
const holds = (key: string) => (item: PickerItem) => keysOf(item).includes(key);

function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <h3 id={id} className={LABEL}>
          {title}
        </h3>
        <span className="font-outlier text-sm font-semibold text-muted tabular-nums">{count}</span>
      </div>
      {children}
    </div>
  );
}
