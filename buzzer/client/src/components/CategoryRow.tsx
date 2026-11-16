import type { MouseEventHandler, ReactNode } from 'react';
import { CHOICE_TILE } from '../lib/ui.js';

// The set library's row and level cells (F139, F149), shared by `/sets` Built-in (SetBrowser's
// catalogue) and the pickers (CategoryPicker): one row per category of a ruled listing (`RULED`:
// the ink bar over it, hairlines between rows), with a choosable cell per level. The row has no
// fill, so a cell never sits in a tile.

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
 * A category: its emoji, name and question total, its level cells, then any actions. In a narrow
 * container the name and the cells share one line (the cells show E, M, H) and the actions take
 * the next; from 42rem of container all three are one line and the cells name their level.
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
    // A pointer shortcut only: the cells' radios are the keyboard's way in.
    <div
      role="group"
      aria-labelledby={headingId}
      onClick={onClick}
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2.5 ${
        // From 64rem the name column fits the longest built-in name on one line (F152).
        actions
          ? '@2xl:grid-cols-[13rem_minmax(0,1fr)_auto] @5xl:grid-cols-[16rem_minmax(0,1fr)_auto]'
          : '@2xl:grid-cols-[13rem_minmax(0,1fr)] @5xl:grid-cols-[16rem_minmax(0,1fr)]'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="w-8 shrink-0 text-center text-2xl leading-none">
          {emoji}
        </span>
        <span className="flex min-w-0 flex-col">
          {/* Data in a ruled table, so Archivo, not the display face (design.md Rules). */}
          <Name
            id={headingId}
            className="font-sans text-base leading-tight font-semibold tracking-normal break-words font-stretch-normal @2xl:text-lg"
          >
            {name}
          </Name>
          <span className="font-outlier text-sm font-semibold text-muted">{meta}</span>
        </span>
      </div>
      {children}
      {actions && (
        <div className="col-span-2 flex min-w-0 items-center gap-2 @2xl:col-span-1">{actions}</div>
      )}
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

/**
 * A level's word: in a narrow container only its initial shows, drawn from `data-initial` as a wide
 * Anybody figure, so the text (and every reader of it) stays "Easy"; from 42rem, the word itself.
 */
export const LEVEL_WORD =
  'font-outlier text-[0px] leading-tight font-semibold before:font-display before:text-lg before:leading-none before:font-black before:font-stretch-150% before:content-[attr(data-initial)] @2xl:text-base @2xl:before:content-none';

/** One level of a category as a choosable cell around a native radio: its initial in a narrow container, its name from 42rem. */
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
      className={`${CHOICE_TILE} flex min-h-11 min-w-11 flex-col items-center justify-center px-1.5 py-1 @2xl:items-start @2xl:px-2.5 @2xl:py-1.5 ${className}`}
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
      <span data-initial={level[0]} className={LEVEL_WORD}>
        {level}
      </span>
      {sub && (
        <span className="hidden max-w-full truncate font-outlier text-sm font-semibold @2xl:block">
          {sub}
        </span>
      )}
    </label>
  );
}
