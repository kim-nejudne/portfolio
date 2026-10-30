import type { ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SMALL, LINK } from '../lib/ui.js';

interface SetPickerProps {
  /** The picker's `h2`, with the id its section or dialog is labelled by. */
  heading: ReactNode;
  /** The top-left link that leaves the picker: Back on the landing page, Cancel in a dialog. */
  back: { label: string; onClick: () => void; disabled?: boolean };
  /** Opens the game builder. Without it, no **Build a game**. */
  onBuild?: () => void;
  buildDisabled?: boolean;
  /** The left pane: the `SetBrowser`, or a loading line. */
  browser: ReactNode;
  /** The picked set and its detail line, for the summary. */
  selected?: { set: QuestionSet; detail: ReactNode };
  /**
   * Adds **Preview** of the picked set to the summary (DECISIONS F56). Never on the Screen: a
   * preview shows answers.
   */
  onPreview?: (set: QuestionSet) => void;
  /** Under the heading, such as Keep scores: the bar stays one or two rows high. */
  extra?: ReactNode;
  /** An error about the pick, above the main action. */
  message?: ReactNode;
  /** Create room, or Start new game. */
  action: { label: string; onClick: () => void; disabled: boolean };
  /** Anything else in the picker, such as an open preview. */
  children?: ReactNode;
  /**
   * In a scrolling dialog padded by 24px, whose sticky area ends at its padding: the bar sits that
   * far lower, on the dialog's edge.
   */
  inDialog?: boolean;
}

/**
 * The set picker of **Host a game** and **New game** (LND-02/03/04/06): Back and **Build a game**
 * on top, the set list flowing with the page, and the picked set with the main action always in
 * view. On a phone or tablet that is a bar stuck to the bottom; at `lg` a pane stuck to the right.
 * The bar's negative margins reach the edges of the card or dialog around it, which pads by 24px.
 */
export function SetPicker({
  heading,
  back,
  onBuild,
  buildDisabled = false,
  browser,
  selected,
  onPreview,
  extra,
  message,
  action,
  children,
  inDialog = false,
}: SetPickerProps) {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-x-8">
      <div className="flex flex-col gap-2 lg:col-span-2">
        {/* Back, the heading and Build a game: stacked on a phone, one row from a tablet up. */}
        <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
          <button
            type="button"
            onClick={back.onClick}
            disabled={back.disabled}
            className={`${LINK} gap-2 self-start text-lg md:self-center`}
          >
            <span aria-hidden="true">←</span>
            {back.label}
          </button>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
            {heading}
            {onBuild && (
              <div className="flex flex-col gap-1 md:flex-row-reverse md:items-center md:gap-3">
                <button
                  type="button"
                  onClick={onBuild}
                  disabled={buildDisabled}
                  aria-describedby="build-hint"
                  className={`${BUTTON_OUTLINE} text-lg`}
                >
                  Build a game
                </button>
                <p id="build-hint" className="text-sm text-muted md:max-w-48 md:text-right">
                  Mix categories or make a category board
                </p>
              </div>
            )}
          </div>
        </div>
        {extra}
      </div>
      <div className="flex min-w-0 flex-col">{browser}</div>
      <aside
        aria-label="Picked set"
        // index.css keeps focus and scrollIntoView above the bar while it is stuck to the bottom.
        data-sticky-bar=""
        className={`sticky z-10 ${inDialog ? '-bottom-6' : 'bottom-0'} -mx-6 -mb-6 flex flex-row flex-wrap items-center gap-3 rounded-b-[18px] border-t-2 border-edge bg-surface px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:top-6 lg:bottom-auto lg:mx-0 lg:mb-0 lg:flex-col lg:items-stretch lg:self-start lg:rounded-2xl lg:border-2 lg:bg-bg lg:p-5`}
      >
        <div className="min-w-40 flex-1">
          {selected ? (
            <>
              <p className="line-clamp-1 font-display text-lg break-words lg:line-clamp-3 lg:text-2xl">
                {selected.set.title}
              </p>
              <p className="text-sm text-muted">
                {selected.set.category && (
                  <span className="hidden lg:inline">{selected.set.category} · </span>
                )}
                {selected.detail}
              </p>
            </>
          ) : (
            <p className="text-muted">Pick a set</p>
          )}
        </div>
        {selected && onPreview && (
          <button
            type="button"
            onClick={() => onPreview(selected.set)}
            aria-label={`Preview ${selected.set.title}`}
            className={`${BUTTON_SMALL} shrink-0 lg:self-start`}
          >
            Preview
          </button>
        )}
        {message && <div className="order-first basis-full lg:order-none">{message}</div>}
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          // On a phone it drops under the summary and fills the bar's width.
          className={`${BUTTON_PRIMARY} grow text-xl lg:py-5 lg:text-2xl`}
        >
          {action.label}
        </button>
      </aside>
      {children}
    </div>
  );
}
