// The lesson's colour classes (pre-F13 fixes, the §9 precache): shiki's inline token styles
// (`style="color:var(--shiki-token-keyword)"` under the CSS-variables theme, since the terminal
// restyle) became a class per style at build time, and each lesson carries the rules for its
// classes once, here. globals.css maps the variables onto the active colour scheme.
export function CodeStyles({ css }: { css: string }) {
  return <style data-code-styles="">{css}</style>;
}
