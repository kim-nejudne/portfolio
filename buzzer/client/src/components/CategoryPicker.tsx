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
import { INPUT, LABEL } from '../lib/ui.js';
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

/** A card or tile: the lift and border under the pointer, all under 250 ms and off when reduced. */
const ITEM =
  'group/item @container/card relative flex min-w-0 cursor-pointer flex-col rounded-[20px] border-2 bg-bg transition duration-200 ease-out motion-reduce:transition-none motion-safe:hover:-translate-y-0.5';
const UNPICKED =
  'border-edge hover:border-[color-mix(in_oklab,var(--color-ink)_30%,var(--color-edge))]';
/** Gold marks only the pick: its ring and glow. */
const PICKED =
  'border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_28%,transparent),0_12px_32px_-8px_color-mix(in_oklab,var(--color-accent)_40%,transparent)]';
/** The emoji's tilt as its card lifts. */
const EMOJI =
  'block leading-none transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none motion-safe:group-hover/item:scale-108 motion-safe:group-hover/item:-rotate-4';
/** A keyboard focus ring on the label around a hidden radio. */
const FOCUS =
  'has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
/** Two columns on a phone, three once the picker has 36rem (a tablet, or beside the ticket). */
const GRID = 'grid grid-cols-2 gap-2.5 @xl:grid-cols-3 @xl:gap-3.5';

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-2 right-2 grid size-7 animate-check-pop place-items-center rounded-full bg-accent text-accent-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)] motion-reduce:animate-none @min-[13rem]/card:top-3 @min-[13rem]/card:right-3"
    >
      <Icon name="check" className="size-4" />
    </span>
  );
}

/**
 * **Host a game** and **New game**'s list (F131): a search box, this browser's sets as tiles, then
 * one card per built-in category with an Easy / Medium / Hard switch, other built-ins as tiles, and
 * **Build a game** last. Every level and tile is a native radio of one group, so the arrow keys move
 * between them; a click on a card's body picks the level last chosen, or the nearest it has.
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
  // The level a card's body picks: the last one chosen on a switch.
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
    const picked = item.key === selectedKey;
    return (
      <label key={item.key} className={`${ITEM} ${FOCUS} ${picked ? PICKED : UNPICKED}`}>
        <input
          type="radio"
          name={name}
          value={item.key}
          checked={picked}
          onChange={() => onSelect(item.key)}
          aria-label={item.set.title}
          className="sr-only"
        />
        {picked && <CheckBadge />}
        {/* Padded inside the label, which is the container: its own padding would shrink it. */}
        <span className="flex flex-col gap-1 p-3 @min-[13rem]/card:p-4">
          <span
            aria-hidden="true"
            className={`${EMOJI} mb-2 text-[30px] @min-[13rem]/card:text-4xl`}
          >
            {item.emoji}
          </span>
          <span className="line-clamp-2 font-display text-sm leading-tight break-words @min-[13rem]/card:text-[17px]">
            {item.set.title}
          </span>
          <span className="text-sm text-muted">{detail(item.set)}</span>
        </span>
      </label>
    );
  }

  function card(item: CategoryCard) {
    const picked = selectedKey !== null && keysOf(item).includes(selectedKey);
    const headingId = `${id}-card-${item.id}`;
    // The body picks a level; a level's own label picks itself.
    const pickBody = (event: MouseEvent) => {
      if (disabled || (event.target as Element).closest('label')) return;
      onSelect(keyToPick(item, lastLevel));
    };
    return (
      // The radios are the keyboard's way in; a click on the body is a shortcut for the pointer.
      <div
        key={item.id}
        role="group"
        aria-labelledby={headingId}
        onClick={pickBody}
        className={`${ITEM} ${picked ? PICKED : UNPICKED}`}
      >
        {picked && <CheckBadge />}
        <div
          className={`flex flex-col gap-1 p-3 pb-2 @min-[13rem]/card:p-4 @min-[13rem]/card:pb-3`}
        >
          <span
            aria-hidden="true"
            className={`${EMOJI} mb-2 text-4xl @min-[13rem]/card:mb-2.5 @min-[13rem]/card:text-5xl`}
          >
            {item.emoji}
          </span>
          <span
            id={headingId}
            className={`line-clamp-2 font-display text-sm leading-tight break-words @min-[13rem]/card:text-[17px]`}
          >
            {item.name}
          </span>
          <span className="text-sm text-muted">{cardMeta(item)}</span>
        </div>
        {/* Flush with the card's edges on a phone, so each level is 44px wide; a pill when wider. */}
        <div
          className={`mt-auto flex rounded-b-[18px] bg-bg-deep p-0.5 @min-[13rem]/card:mx-3 @min-[13rem]/card:mb-3 @min-[13rem]/card:rounded-full @min-[13rem]/card:border-2 @min-[13rem]/card:border-edge @min-[13rem]/card:p-[3px]`}
        >
          {DIFFICULTIES.map((level) => {
            const keyed = item.levels[level];
            const label = DIFFICULTY_LABELS[level];
            const text = (
              <>
                <span aria-hidden="true" className={`@min-[13rem]/card:hidden`}>
                  {label[0]}
                </span>
                <span aria-hidden="true" className={`hidden @min-[13rem]/card:inline`}>
                  {label}
                </span>
              </>
            );
            const segment =
              'flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors duration-150 motion-reduce:transition-none';
            // A level the category lacks keeps its place, so the switches line up across cards.
            if (!keyed)
              return (
                <span key={level} aria-hidden="true" className={`${segment} text-edge`}>
                  {text}
                </span>
              );
            const on = keyed.key === selectedKey;
            return (
              <label
                key={level}
                className={`${segment} ${FOCUS} cursor-pointer ${on ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-ink/8 hover:text-ink'}`}
              >
                <input
                  type="radio"
                  name={name}
                  value={keyed.key}
                  checked={on}
                  onChange={() => {
                    setLastLevel(level);
                    onSelect(keyed.key);
                  }}
                  aria-label={keyed.set.title}
                  className="sr-only"
                />
                {text}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  const render = (item: PickerItem) => (item.kind === 'tile' ? tile(item) : card(item));

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
            <div className={GRID}>{shown.yours.map(render)}</div>
          </Section>
        )}
        <Section id={`${id}-built-in`} title="Built-in" count={shown.builtIn.length}>
          {builtInError}
          {items.length === 0 && (
            <p role="status" className="py-2 text-center text-muted">
              No sets match.
            </p>
          )}
          {(shown.builtIn.length > 0 || onBuild) && (
            <div className={GRID}>
              {shown.builtIn.map(render)}
              {onBuild && (
                <button
                  type="button"
                  onClick={onBuild}
                  disabled={buildDisabled}
                  aria-label="Build a game"
                  aria-describedby={`${id}-build-hint`}
                  className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[color-mix(in_oklab,var(--color-accent)_55%,var(--color-edge))] p-4 text-center text-accent transition duration-200 ease-out motion-reduce:transition-none not-disabled:hover:border-accent not-disabled:hover:bg-accent/6 motion-safe:not-disabled:hover:-translate-y-0.5 disabled:opacity-40 @xl:min-h-44"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-12 place-items-center rounded-full border-2 border-current text-3xl leading-none"
                  >
                    +
                  </span>
                  <span className="font-display text-sm @xl:text-[17px]">Build a game</span>
                  <span id={`${id}-build-hint`} className="max-w-[18ch] text-sm text-muted">
                    Mix categories or make a category board
                  </span>
                </button>
              )}
            </div>
          )}
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
        <span className="text-sm text-muted">{count}</span>
      </div>
      {children}
    </div>
  );
}
