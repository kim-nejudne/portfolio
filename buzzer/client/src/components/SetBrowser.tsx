import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { HOVER } from '../lib/hover.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
import {
  DIFFICULTY_CHIPS,
  filterSets,
  groupByCategory,
  type DifficultyChip,
  type SetFilter,
} from '../lib/setFilter.js';
import { INPUT, LABEL } from '../lib/ui.js';

const CHIP_LABELS: Record<DifficultyChip, string> = { ...DIFFICULTY_LABELS, none: 'None' };

interface CommonProps {
  sets: readonly QuestionSet[];
  /** Prefixes the element ids, so two browsers on one page stay apart. */
  id: string;
  /** The line under a set's title. */
  detail: (set: QuestionSet) => ReactNode;
  /** Extra classes for the list's box under the search and chips. */
  listClassName?: string;
  className?: string;
}

/** One radio per set, for the pickers. */
interface SelectProps extends CommonProps {
  mode: 'select';
  legend: string;
  selectedId: string | null;
  /** Null when the search or chips hide the selected set. */
  onSelect: (id: string | null) => void;
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
 * Every set list (DECISIONS F55): a search box, difficulty chips, then the sets that match, grouped
 * by category in the order given. Enter in the search box picks the one set left.
 */
export function SetBrowser(props: SelectProps | ActionProps) {
  const { sets, id, detail, listClassName = '', className = '' } = props;
  const [filter, setFilter] = useState<SetFilter>({ query: '', difficulties: [] });
  const listRef = useRef<HTMLDivElement>(null);
  const shown = filterSets(sets, filter);
  const groups = groupByCategory(shown);
  const disabled = props.mode === 'select' && props.disabled === true;

  function change(next: SetFilter) {
    setFilter(next);
    // A selection the host can no longer see is not one they meant to start.
    if (props.mode !== 'select' || props.selectedId === null) return;
    if (!filterSets(sets, next).some((set) => set.id === props.selectedId)) props.onSelect(null);
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
      props.onSelect(only.id);
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-set-id="${CSS.escape(only.id)}"] :is(a, button)`)
      ?.focus();
  }

  const list =
    props.mode === 'select' ? (
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
                <div
                  key={set.id}
                  className="flex rounded-xl border-2 border-edge bg-bg has-checked:border-accent"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-4 py-3 @2xl:gap-2 @2xl:px-3">
                    <input
                      type="radio"
                      name={`${id}-set`}
                      value={set.id}
                      checked={props.selectedId === set.id}
                      onChange={() => props.onSelect(set.id)}
                      className="mt-1 size-5 shrink-0 accent-accent"
                    />
                    <span className="flex min-w-0 flex-col">
                      {/* Two lines before it clips: a built-in title never needs more (LND-02). */}
                      <span className="line-clamp-2 break-words @2xl:text-base">{set.title}</span>
                      <span className="text-sm text-muted">{detail(set)}</span>
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
            {/* Only `/sets` lists cards, in a page of its own, so the columns follow the window (LIB-01). */}
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.sets.map((set) => (
                <li
                  key={set.id}
                  data-set-id={set.id}
                  aria-labelledby={`${id}-set-${set.id}`}
                  // Tight enough that two full rows of three show at 1440×900 (LIB-01).
                  className="flex flex-col gap-2 rounded-[20px] border-2 border-edge bg-surface p-4"
                >
                  <div className="min-w-0">
                    <h3
                      id={`${id}-set-${set.id}`}
                      className="line-clamp-2 font-display text-xl break-words"
                    >
                      {props.cardTitle ? props.cardTitle(set) : set.title}
                    </h3>
                    <p className="text-muted">{detail(set)}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-2">{props.actions(set)}</div>
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
          className={`${INPUT} shrink-0 py-2 text-lg placeholder:text-muted @2xl:min-w-0 @2xl:flex-1`}
        />
        <div role="group" aria-label="Difficulty" className="flex shrink-0 flex-wrap gap-2">
          {DIFFICULTY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              aria-pressed={filter.difficulties.includes(chip)}
              onClick={() => toggle(chip)}
              disabled={disabled}
              className={`min-h-11 rounded-full border-2 border-edge px-4 text-base font-bold text-muted transition not-disabled:active:scale-95 disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink ${HOVER}`}
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
