import type { Phase } from '../../../shared/types.js';

/** A losing buzz's gap to the winner, as the Screen shows it: "+0.12 s". */
export function formatGap(gapMs: number): string {
  return `+${(Math.round(gapMs / 10) / 100).toFixed(2)} s`;
}

/**
 * Font sizes for the question text, largest first. Each is capped by height as well as width, so
 * a short or wide window still fits. Full class strings, so Tailwind can see them.
 */
const TEXT_STEPS = [
  'text-[min(6vw,11vh)]',
  'text-[min(4.8vw,8.5vh)]',
  'text-[min(3.8vw,6.8vh)]',
  'text-[min(3vw,5.4vh)]',
  'text-[min(2.4vw,4.3vh)]',
] as const;

/** Upper text length for each step but the last. */
const STEP_LIMITS = [40, 90, 150, 220];

/**
 * The question text's size, shrinking with its length (UI spec, Screen view: auto-shrinks to fit).
 * An image takes half the space, so it starts one step down.
 */
// SPEC-QUESTION: "auto-shrinks to fit" is done by length steps, not by measuring the box (DECISIONS, F18).
export function questionTextClass(text: string, hasImage: boolean): string {
  const length = text.trim().length;
  let step = STEP_LIMITS.findIndex((limit) => length <= limit);
  if (step === -1) step = STEP_LIMITS.length;
  if (hasImage) step += 1;
  return TEXT_STEPS[Math.min(step, TEXT_STEPS.length - 1)]!;
}

/** True while a buzz counts: buzzers open, or the 150 ms collection window after the first buzz. */
export function buzzersOpen(phase: Phase): boolean {
  return phase === 'OPEN' || phase === 'COLLECTING';
}
