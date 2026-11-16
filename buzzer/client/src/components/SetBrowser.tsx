import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { HOVER } from '../lib/hover.js';
import { DIFFICULTY_LABELS, questionCount } from '../lib/setLabels.js';
import {
  DIFFICULTY_CHIPS,
  filterSets,
  groupByCategory,
  type DifficultyChip,
  type SetFilter,
} from '../lib/setFilter.js';
import { CHOICE_TILE, INPUT, LABEL, RULED } from '../lib/ui.js';
import { CategoryRow, LevelTile } from './CategoryRow.js';

const CHIP_LABELS: Record<DifficultyChip, string> = { ...DIFFICULTY_LABELS, none: 'None' };

interface CommonProps {
  sets: readonly QuestionSet[];
  /** Prefixes the element ids, so two browsers on one page stay apart. */
  id: string;
  /** The line under a set's title; in the catalogue, under its level. */
  detail: (set: QuestionSet) => ReactNode;
  /** A set's key in the list, its id by default. The pickers key by source too (DECISIONS F104). */
  keyOf?: (set: QuestionSet) => string;
  /** Extra classes for the list's box under the search and chips. */
  listClassName?: string;
  className?: string;
}

/** One radio per set, for the pickers. */
interface SelectProps extends CommonProps {
  mode: 'select';
  legend: string;
  /** The selected set's key (`keyOf`). */
  selectedId: string | null;
  /** Null when the search or chips hide the selected set. */
  onSelect: (key: string | null) => void;
  disabled?: boolean;
}

/** One card per set with its buttons, for `/sets`. */
interface ActionProps extends CommonProps {
  mode: 'actions';
  /**
   * What the card's heading holds: by default the title as text, on `/sets` a link to the set
   * (LIB-02). Enter in the search box focuses the first link or button of the one card left.
   */
  cardTitle?: (set: QuestionSet) => ReactNode;
  /** The card's action row: Host, Preview and its `⋯` menu on `/sets`. */
  actions: (set: QuestionSet) => ReactNode;
}

/**
 * `/sets` Built-in as a catalogue (F139): a row per category with a choosable tile per level, and
 * the chosen level's actions beside them.
 */
interface CatalogueProps extends CommonProps {
  mode: 'catalogue';
  /** A category's emoji. */
  emojiOf: (category: string) => string;
  /** The chosen level's actions: Host, Preview and its `⋯` menu. */
  actions: (set: QuestionSet) => ReactNode;
}

/** A set's place in its row: Easy, Medium, Hard, then None. */
const chipOf = (set: QuestionSet): DifficultyChip => set.difficulty ?? 'none';
const byLevel = (a: QuestionSet, b: QuestionSet) =>
  DIFFICULTY_CHIPS.indexOf(chipOf(a)) - DIFFICULTY_CHIPS.indexOf(chipOf(b));

/**
 * Every set list (DECISIONS F55): a search box, difficulty chips, then the sets that match, grouped
 * by category in the order given. Enter in the search box picks the one set left.
 */
export function SetBrowser(props: SelectProps | ActionProps | CatalogueProps) {
  const { sets, id, detail, keyOf = (set) => set.id, listClassName = '', className = '' } = props;
  const [filter, setFilter] = useState<SetFilter>({ query: '', difficulties: [] });
  const listRef = useRef<HTMLDivElement>(null);
  // The catalogue's chosen level per category, by group key; a row's first level until chosen.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const shown = filterSets(sets, filter);
  const groups = groupByCategory(shown);
  const disabled = props.mode === 'select' && props.disabled === true;

  function change(next: SetFilter) {
    setFilter(next);
    // A selection the host can no longer see is not one they meant to start.
    if (props.mode !== 'select' || props.selectedId === null) return;
    if (!filterSets(sets, next).some((set) => keyOf(set) === props.selectedId))
      props.onSelect(null);
  }

  function toggle(chip: DifficultyChip) {
    const on = filter.difficulties.includes(chip);
    const difficulties = on
      ? filter.difficulties.filter((c) => c !== chip)
      : DIFFICULTY_CHIPS.filter((c) => c === chip || filter.difficulties.includes(c));
    change({ ...filter, difficulties });
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || shown.length !== 1) return;
    event.preventDefault();
    const only = shown[0]!;
    if (props.mode === 'select') {
      props.onSelect(keyOf(only));
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-set-id="${CSS.escape(keyOf(only))}"] :is(a, button)`)
      ?.focus();
  }

  const catalogue = (props: CatalogueProps) => (
    <ul className={RULED}>
      {groups.map((group, index) => {
        const sets = [...group.sets].sort(byLevel);
        const groupKey = group.category.toLowerCase();
        const pick = sets.find((set) => keyOf(set) === chosen[groupKey]) ?? sets[0]!;
        const total = sets.reduce((sum, set) => sum + set.questions.length, 0);
        return (
          <li key={groupKey}>
            <CategoryRow
              headingId={`${id}-group-${index}`}
              nameAs="h2"
              emoji={props.emojiOf(group.category)}
              name={group.category}
              meta={questionCount(total)}
              actions={
                <>
                  {/* The cells show only E, M, H here, so the chosen level's line goes with its
                      actions, named, so it can't be read as the row's total (F152). */}
                  <span className="min-w-0 flex-1 truncate font-outlier text-sm font-semibold text-muted @2xl:hidden">
                    {CHIP_LABELS[chipOf(pick)]} · {detail(pick)}
                  </span>
                  <div
                    role="group"
                    aria-label={pick.title}
                    data-set-id={keyOf(pick)}
                    className="flex items-center gap-2"
                  >
                    {props.actions(pick)}
                  </div>
                </>
              }
            >
              <div className="flex gap-1.5 @2xl:grid @2xl:auto-cols-[minmax(0,8rem)] @2xl:grid-flow-col @2xl:gap-2">
                {sets.map((set) => (
                  <LevelTile
                    key={keyOf(set)}
                    name={`${id}-group-${index}-level`}
                    value={keyOf(set)}
                    checked={set === pick}
                    onChange={() => setChosen({ ...chosen, [groupKey]: keyOf(set) })}
                    title={set.title}
                    level={CHIP_LABELS[chipOf(set)]}
                    sub={detail(set)}
                  />
                ))}
              </div>
            </CategoryRow>
          </li>
        );
      })}
    </ul>
  );

  const list =
    props.mode === 'catalogue' ? (
      catalogue(props)
    ) : props.mode === 'select' ? (
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">{props.legend}</legend>
        {groups.map((group, index) => (
          <div
            key={group.category}
            role="group"
            aria-labelledby={`${id}-group-${index}`}
            className="flex flex-col gap-2"
          >
            <h3 id={`${id}-group-${index}`} className={LABEL}>
              {group.category}
            </h3>
            <div className="grid gap-2 @md:grid-cols-2 @2xl:grid-cols-3">
              {group.sets.map((set) => (
                <div key={keyOf(set)} className={`flex ${CHOICE_TILE}`}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-3 @2xl:gap-2 @2xl:px-3">
                    <input
                      type="radio"
                      name={`${id}-set`}
                      value={keyOf(set)}
                      checked={props.selectedId === keyOf(set)}
                      onChange={() => props.onSelect(keyOf(set))}
                      className="mt-1 size-5 shrink-0 accent-ink"
                    />
                    <span className="flex min-w-0 flex-col">
                      {/* Two lines before it clips: a built-in title never needs more (LND-02). */}
                      <span className="line-clamp-2 break-words @2xl:text-base">{set.title}</span>
                      <span className="font-outlier text-sm font-semibold">{detail(set)}</span>
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    ) : (
      <div className="flex flex-col gap-5">
        {groups.map((group, index) => (
          <section
            key={group.category}
            aria-labelledby={`${id}-group-${index}`}
            className="flex flex-col gap-2"
          >
            <h2 id={`${id}-group-${index}`} className={LABEL}>
              {group.category}
            </h2>
            {/* My sets keeps its actions as rows (F139), ruled like the catalogue (F149). */}
            <ul className={RULED}>
              {group.sets.map((set) => (
                <li
                  key={keyOf(set)}
                  data-set-id={keyOf(set)}
                  aria-labelledby={`${id}-set-${keyOf(set)}`}
                  className="flex min-w-0 flex-col gap-2 py-2.5 md:flex-row md:items-center md:gap-4"
                >
                  <div className="min-w-0 md:flex-1">
                    <h3
                      id={`${id}-set-${keyOf(set)}`}
                      className="line-clamp-2 font-sans text-lg font-semibold tracking-normal break-words font-stretch-normal"
                    >
                      {props.cardTitle ? props.cardTitle(set) : set.title}
                    </h3>
                    <p className="font-outlier text-sm font-semibold text-muted">{detail(set)}</p>
                  </div>
                  <div className="flex items-center gap-2">{props.actions(set)}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );

  return (
    // A container: the list's columns, and the search and chips sharing a row, follow the room the
    // browser has, not the window (LND-02).
    <div className={`@container flex flex-col gap-3 ${className}`}>
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center">
        <input
          type="search"
          value={filter.query}
          onChange={(event) => change({ ...filter, query: event.target.value })}
          onKeyDown={onSearchKey}
          disabled={disabled}
          aria-label="Search sets"
          placeholder="Search title or category"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className={`${INPUT} shrink-0 py-2! text-base placeholder:text-muted @2xl:min-w-0 @2xl:flex-1`}
        />
        <div role="group" aria-label="Difficulty" className="flex shrink-0 flex-wrap gap-2">
          {DIFFICULTY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={filter.difficulties.includes(chip)}
              onClick={() => toggle(chip)}
              disabled={disabled}
              className={`min-h-11 rounded-control border-2 border-ink px-3 font-outlier text-base font-semibold text-ink uppercase not-disabled:active:bg-bg-deep disabled:opacity-40 sm:px-4 aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:mix-blend-multiply ${HOVER}`}
            >
              {CHIP_LABELS[chip]}
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} className={listClassName}>
        {shown.length === 0 ? (
          <p role="status" className="py-4 text-center text-muted">
            No sets match.
          </p>
        ) : (
          list
        )}
      </div>
    </div>
  );
}
