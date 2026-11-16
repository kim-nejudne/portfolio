import type { ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import type { Ticket } from '../lib/categoryCards.js';
import { BUTTON_PRIMARY, LINK } from '../lib/ui.js';

interface SetPickerProps {
  /** The picker's `h2`, with the id its section or dialog is labelled by. */
  heading: ReactNode;
  /** The top-left link that leaves the picker: Back on the landing page, Cancel in a dialog. */
  back: { label: string; onClick: () => void; disabled?: boolean };
  /** The left pane: the `CategoryPicker`, or a loading line. */
  browser: ReactNode;
  /** The picked set and its ticket (F131). */
  selected?: { set: QuestionSet; ticket: Ticket };
  /**
   * Adds **Preview** of the picked set to the ticket (DECISIONS F56). Never on the Screen: a
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
 * The set picker of **Host a game** and **New game** (LND-02/03/04/06, F131): Back and the heading
 * on top, the cards flowing with the page, and the picked set with the main action always in view.
 * On a phone or tablet that is a bar stuck to the bottom under the ink bar, its emoji in a 44px
 * square; at `lg` a ticket stuck to the right, paper-2 under the ink bar (emoji, tear line, kicker,
 * title, chips; F149). The bar's negative margins
 * reach the edges of the card or dialog around it, which pads by 24px.
 */
export function SetPicker({
  heading,
  back,
  browser,
  selected,
  onPreview,
  extra,
  message,
  action,
  children,
  inDialog = false,
}: SetPickerProps) {
  const ticket = selected?.ticket;
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-x-8">
      <div className="flex flex-col gap-2 lg:col-span-2">
        {/* Back and the heading: stacked on a phone, one row from a tablet up. */}
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
          <div className="flex-1">
            {heading}
            <p className="font-outlier text-base font-semibold text-muted">
              Choose a category, then a level
            </p>
          </div>
        </div>
        {extra}
      </div>
      <div className="flex min-w-0 flex-col">{browser}</div>
      <aside
        aria-label="Picked set"
        // index.css keeps focus and scrollIntoView above the bar while it is stuck to the bottom.
        data-sticky-bar=""
        className={`sticky z-10 ${inDialog ? '-bottom-6' : 'bottom-0'} -mx-6 -mb-6 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t-4 border-ink bg-bg px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:top-6 lg:bottom-auto lg:mx-0 lg:mb-0 lg:flex lg:flex-col lg:items-stretch lg:gap-0 lg:self-start lg:bg-surface lg:p-0`}
      >
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center bg-surface text-[26px] leading-none lg:mx-5 lg:mt-5 lg:mb-4 lg:block lg:size-auto lg:bg-transparent lg:text-[64px]"
        >
          {ticket?.emoji}
        </span>
        {/* The ticket's tear line: a dashed hairline across it, square like everything else. */}
        <div aria-hidden="true" className="hidden border-t-2 border-dashed border-ink lg:block" />
        <div className="min-w-0 lg:mx-5 lg:mt-4 lg:flex lg:flex-col lg:gap-2.5">
          {selected && ticket ? (
            <>
              <p className="hidden font-outlier text-sm font-semibold text-muted lg:block">
                {ticket.kicker}
              </p>
              <p className="line-clamp-1 font-display text-base leading-tight font-black break-words uppercase lg:line-clamp-3 lg:text-2xl">
                {ticket.title}
              </p>
              <p className="truncate font-outlier text-sm font-semibold text-muted lg:hidden">
                {ticket.chips.map((chip) => chip.label).join(' · ')}
              </p>
              <ul className="hidden flex-wrap gap-1.5 lg:flex">
                {ticket.chips.map((chip) => (
                  <li
                    key={chip.label}
                    className={`rounded-pill px-3 py-1 font-outlier text-sm font-semibold ${chip.level ? 'bg-accent text-accent-ink mix-blend-multiply' : 'inset-ring-2 inset-ring-ink text-ink'}`}
                  >
                    {chip.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-outlier font-semibold text-muted">Pick a set</p>
          )}
        </div>
        {selected && onPreview ? (
          <button
            type="button"
            onClick={() => onPreview(selected.set)}
            aria-label={`Preview ${selected.set.title}`}
            className={`${LINK} shrink-0 gap-1.5 text-[15px] font-bold lg:mx-5 lg:mt-1 lg:self-start lg:text-base`}
          >
            Preview<span className="hidden lg:inline"> questions</span>
          </button>
        ) : (
          <span />
        )}
        {message && <div className="col-span-3 row-start-1 lg:mx-5 lg:mt-2">{message}</div>}
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          // On a phone it fills the bar's width under the summary.
          className={`${BUTTON_PRIMARY} col-span-3 mt-2 text-xl lg:mx-5 lg:mt-3 lg:mb-5 lg:py-5 lg:text-2xl`}
        >
          {action.label}
        </button>
      </aside>
      {children}
    </div>
  );
}
