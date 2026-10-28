import { HOVER } from '../lib/hover.js';

/**
 * The labels of buttons under `root` without the F44 hover style. Text-link buttons keep their own
 * `hover:text-ink`. Throws when there is no button at all, so a test cannot pass on an empty page.
 */
export function buttonsWithoutHover(root: ParentNode = document.body): string[] {
  const buttons = [...root.querySelectorAll<HTMLElement>('button, a[href]')].filter(
    (el) => el.tagName === 'BUTTON' || el.className.includes('border-2'),
  );
  if (buttons.length === 0) throw new Error('no buttons to check');
  return buttons
    .filter((el) => !el.className.includes(HOVER) && !el.className.includes('hover:text-ink'))
    .map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');
}
