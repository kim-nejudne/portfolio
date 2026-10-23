// The lesson's colour classes (pre-F13 fixes, the §9 precache): shiki's inline
// `style="--shiki-light:…;--shiki-dark:…"` became a class per colour pair at build time, and
// each lesson carries the rules for its classes once, here. The theme CSS in globals.css reads
// the variables as before.
export function CodeStyles({ css }: { css: string }) {
  return <style data-code-styles="">{css}</style>;
}
