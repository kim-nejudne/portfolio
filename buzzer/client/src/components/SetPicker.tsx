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
 * On a phone or tablet that is a bar stuck to the bottom, its emoji in a 44px square; at `lg` a
 * ticket stuck to the right (emoji, perforation, kicker, title, chips). The bar's negative margins
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
            <p className="text-muted">Choose a category, then a level</p>
          </div>
        </div>
        {extra}
      </div>
      <div className="flex min-w-0 flex-col">{browser}</div>
      <aside
        aria-label="Picked set"
        // index.css keeps focus and scrollIntoView above the bar while it is stuck to the bottom.
        data-sticky-bar=""
        className={`sticky z-10 ${inDialog ? '-bottom-6' : 'bottom-0'} -mx-6 -mb-6 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-b-[18px] border-t-2 border-edge bg-surface px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:top-6 lg:bottom-auto lg:mx-0 lg:mb-0 lg:flex lg:flex-col lg:items-stretch lg:gap-0 lg:self-start lg:rounded-[20px] lg:border-2 lg:bg-bg lg:p-0`}
      >
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-xl border-2 border-edge bg-bg-deep text-[26px] leading-none lg:mx-5 lg:mt-5 lg:mb-4 lg:block lg:size-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:text-[64px]"
        >
          {ticket?.emoji}
        </span>
        {/* The ticket's perforation: a dashed tear line with a notch cut from each side. */}
        <div
          aria-hidden="true"
          className="relative mx-[18px] hidden border-t-2 border-dashed border-edge before:absolute before:-top-3 before:-left-8 before:size-[22px] before:rounded-full before:border-2 before:border-edge before:bg-surface after:absolute after:-top-3 after:-right-8 after:size-[22px] after:rounded-full after:border-2 after:border-edge after:bg-surface lg:block"
        />
        <div className="min-w-0 lg:mx-5 lg:mt-4 lg:flex lg:flex-col lg:gap-2.5">
          {selected && ticket ? (
            <>
              <p className="hidden text-[13px] font-bold tracking-[3px] text-muted uppercase lg:block">
                {ticket.kicker}
              </p>
              <p className="line-clamp-1 font-display text-base leading-tight break-words lg:line-clamp-3 lg:text-[26px]">
                {ticket.title}
              </p>
              <p className="truncate text-sm text-muted lg:hidden">
                {ticket.chips.map((chip) => chip.label).join(' · ')}
              </p>
              <ul className="hidden flex-wrap gap-1.5 lg:flex">
                {ticket.chips.map((chip) => (
                  <li
                    key={chip.label}
                    className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${chip.level ? 'border-accent text-accent' : 'border-edge text-muted'}`}
                  >
                    {chip.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted">Pick a set</p>
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
            <span aria-hidden="true" className="hidden lg:inline">
              →
            </span>
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
