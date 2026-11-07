// Class names shared by the admin pages (DESIGN.md "Button", "Input"; board tokens only).

export const CARD = 'flex flex-col gap-4 rounded-card border border-line bg-board-panel p-6';
export const BUTTON_PRIMARY =
  'inline-flex min-h-12 items-center justify-center rounded-button bg-amber px-6 text-lg font-semibold text-board-bg [@media(hover:hover)]:hover:brightness-110 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100';
export const BUTTON_SECONDARY =
  'inline-flex min-h-12 items-center justify-center rounded-button border border-line px-6 text-lg font-semibold text-text [@media(hover:hover)]:hover:bg-board-bg disabled:opacity-50';
export const BUTTON_DANGER =
  'inline-flex min-h-12 items-center justify-center rounded-button border border-delayed px-6 text-lg font-semibold text-delayed [@media(hover:hover)]:hover:bg-board-bg disabled:opacity-50';
export const INPUT =
  'h-12 w-full min-w-0 rounded-button border border-line bg-board-panel px-4 text-lg text-text placeholder:text-text-dim';
export const LINK =
  'inline-flex min-h-12 items-center font-semibold text-text underline-offset-4 [@media(hover:hover)]:hover:text-amber [@media(hover:hover)]:hover:underline aria-[current=page]:text-amber';

export const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
