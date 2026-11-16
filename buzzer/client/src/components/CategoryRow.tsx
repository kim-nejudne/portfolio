import type { MouseEventHandler, ReactNode } from 'react';
import { CHOICE_TILE } from '../lib/ui.js';

// The set library's row and tile pieces (F139), shared by `/sets` Built-in (SetBrowser's
// catalogue) and the pickers (CategoryPicker): one row per category on the paper, split by
// hairlines (the list's `divide-y`), with a choosable tile per level. The row is no tile, so a tile never sits in a tile.

interface CategoryRowProps {
  /** The id of the row's name, which labels the row. */
  headingId: string;
  /** The element the name is: a heading on `/sets`, plain text in a picker's radio group. */
  nameAs?: 'h2' | 'h3' | 'span';
  emoji: string;
  name: string;
  /** The line under the name: the question total. */
  meta: string;
  /** The level tiles. */
  children: ReactNode;
  /** What the chosen level offers (Host, Preview, `⋯` on `/sets`). */
  actions?: ReactNode;
  /** A click on the row outside its tiles: the picker's shortcut to a level. */
  onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * A category: its emoji, name and question total, its level tiles, then any actions. Stacked in a
 * narrow container; one line from 42rem of container (the browser or picker is the container).
 */
export function CategoryRow({
  headingId,
  nameAs: Name = 'span',
  emoji,
  name,
  meta,
  children,
  actions,
  onClick,
}: CategoryRowProps) {
  return (
    // A pointer shortcut only: the tiles' radios are the keyboard's way in.
    <div
      role="group"
      aria-labelledby={headingId}
      onClick={onClick}
      className={`grid min-w-0 gap-3 py-3 @2xl:items-center ${
        actions
          ? '@2xl:grid-cols-[13rem_minmax(0,1fr)_auto]'
          : '@2xl:grid-cols-[13rem_minmax(0,1fr)]'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="w-10 shrink-0 text-center text-3xl leading-none">
          {emoji}
        </span>
        <span className="flex min-w-0 flex-col">
          <Name
            id={headingId}
            className="font-display text-lg leading-tight font-extrabold break-words"
          >
            {name}
          </Name>
          <span className="text-sm text-muted">{meta}</span>
        </span>
      </div>
      {children}
      {actions}
    </div>
  );
}

interface LevelTileProps {
  /** The radio group's name: one per row on `/sets`, one for the whole picker. */
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  /** The radio's name: the set's title, so each level is told apart by what it hosts. */
  title: string;
  /** "Easy", "Medium", "Hard" or "None". */
  level: string;
  /** The line under the level: its question count, a Draft note. */
  sub?: ReactNode;
  className?: string;
}

/** One level of a category as a choosable tile around a native radio. */
export function LevelTile({
  name,
  value,
  checked,
  onChange,
  title,
  level,
  sub,
  className = '',
}: LevelTileProps) {
  return (
    <label
      className={`${CHOICE_TILE} flex min-h-11 min-w-0 flex-col justify-center px-3 py-1.5 ${className}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={title}
        className="sr-only"
      />
      <span className="font-sans text-base leading-tight font-bold">{level}</span>
      {sub && <span className="truncate text-sm text-muted">{sub}</span>}
    </label>
  );
}
