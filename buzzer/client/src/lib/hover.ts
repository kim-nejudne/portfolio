// The hover style of the mouse-driven pages: the Screen host bar, Sets and SetEditor (F44).

/**
 * An ink border and a faint tint on a live button under the pointer. Tailwind v4 puts `hover:` in
 * `@media (hover: hover)`, so touch screens never show it, and `not-disabled:` skips dead buttons.
 */
export const HOVER = 'not-disabled:hover:border-ink not-disabled:hover:hover-tint';
