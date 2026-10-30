/**
 * Class-string checks for the Screen's legibility rules (F100). jsdom has no layout, so these read
 * the arbitrary values in the class names; the browser evidence is the F100 playtest.
 */

/** Every class token under `root` (itself included) with its arbitrary value, e.g. `text-[…]`. */
function arbitraryTokens(root: Element): { token: string; utility: string; value: string }[] {
  const out: { token: string; utility: string; value: string }[] = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const classes = el.getAttribute('class');
    if (!classes) continue;
    for (const token of classes.split(/\s+/)) {
      const match = /^((?:[^:[\]]+:|\[[^\]]*\]:)*)([\w-]+)-\[(.+)\]$/.exec(token);
      if (match) out.push({ token, utility: match[2]!, value: match[3]! });
    }
  }
  return out;
}

const VIEWPORT_UNIT = /\d(?:vw|vh|cqw|cqh|svw|svh|dvh)\b/;

/** Below 1em: smaller than its parent's size, which may already be at the floor. */
const SHRINKING_EM = /^0?\.\d+em$/;

/**
 * Text sizes in viewport or container units, or under 1em, with no lower bound: not
 * `max(<floor>, …)` and not `clamp(<floor>, …)`. On a small display such a size can fall under 14px.
 */
export function textSizesWithoutFloor(root: Element): string[] {
  return arbitraryTokens(root)
    .filter(
      ({ utility, value }) =>
        utility === 'text' && (VIEWPORT_UNIT.test(value) || SHRINKING_EM.test(value)),
    )
    .filter(({ value }) => !/^(?:max|clamp)\(/.test(value))
    .map(({ token }) => token);
}

/**
 * Sizes in bare `vw` or `cqw`, outside a `min()` with a height term: they grow without bound on an
 * ultrawide display. Variants for portrait or narrow stages are about width on purpose.
 */
export function pureWidthSizes(root: Element): string[] {
  return arbitraryTokens(root)
    .filter(({ token }) => !/^(?:stage-portrait|stage-narrow|@max-\[[^\]]*\]):/.test(token))
    .filter(({ value }) => /(?<![(,\d.])\d+(?:\.\d+)?(?:vw|cqw)/.test(value))
    .map(({ token }) => token);
}
