import { RefObject, useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Makes a container behave like a modal dialog for the keyboard.
 *
 * A dialog that renders over the page but leaves focus behind it is a dialog
 * only for people using a mouse: everyone else keeps tabbing through the
 * document underneath, operating controls they cannot see. This moves focus in,
 * keeps Tab and Shift+Tab inside, closes on Escape, and — the part most often
 * missed — puts focus back where it came from on close, so the list does not
 * dump you at the top of the page.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, onEscape }: { active: boolean; onEscape: () => void }
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = (): HTMLElement[] => {
      const found: HTMLElement[] = [];
      container.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
        // offsetParent is null for anything display:none, which should not be
        // a stop in the cycle. The active element is kept regardless so the
        // current position is never lost mid-trap.
        if (el.offsetParent !== null || el === document.activeElement) found.push(el);
      });
      return found;
    };

    focusable()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      // Focus can also be outside the dialog entirely — after a click on the
      // backdrop, say — in which case Tab has to be pulled back in.
      if (!container.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    // Stop the page behind the dialog from scrolling under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [active, containerRef, onEscape]);
}
