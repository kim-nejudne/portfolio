export const SHORTCUTS = [
  { keys: 'g r', action: 'open-roadmap', scope: 'global' },
  { keys: 'g s', action: 'open-settings', scope: 'global' },
  { keys: '?', action: 'show-help', scope: 'global' },
  { keys: ']d', action: 'next-diagnostic', scope: 'editor' },
  { keys: '[d', action: 'previous-diagnostic', scope: 'editor' },
  { keys: 'K', action: 'show-hover', scope: 'editor' },
] as const;

// Written by hand, these types accept shortcuts that SHORTCUTS doesn't have.
// Derive all three from SHORTCUTS instead.
export type Shortcut = { keys: string; action: string; scope: string };
export type Action = string;
export type Scope = string;

/** The keys of the shortcut in the list that runs the action, or undefined when none does. */
export function keysFor(
  shortcuts: readonly Shortcut[],
  action: Action,
): Shortcut['keys'] | undefined {
  throw new Error(
    `not implemented for ${shortcuts.length} shortcuts and ${action}`,
  );
}

/** The actions in the list grouped by scope, in list order; a scope with no shortcuts gets []. */
export function actionsByScope(
  shortcuts: readonly Shortcut[],
): Record<Scope, Action[]> {
  throw new Error(`not implemented for ${shortcuts.length} shortcuts`);
}
