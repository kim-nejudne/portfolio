export const SHORTCUTS = [
  { keys: 'g r', action: 'open-roadmap', scope: 'global' },
  { keys: 'g s', action: 'open-settings', scope: 'global' },
  { keys: '?', action: 'show-help', scope: 'global' },
  { keys: ']d', action: 'next-diagnostic', scope: 'editor' },
  { keys: '[d', action: 'previous-diagnostic', scope: 'editor' },
  { keys: 'K', action: 'show-hover', scope: 'editor' },
] as const;

// Derived from SHORTCUTS: a shortcut added to the list changes all three.
export type Shortcut = (typeof SHORTCUTS)[number];
export type Action = Shortcut['action'];
export type Scope = Shortcut['scope'];

/** The keys of the shortcut in the list that runs the action, or undefined when none does. */
export function keysFor(
  shortcuts: readonly Shortcut[],
  action: Action,
): Shortcut['keys'] | undefined {
  return shortcuts.find((shortcut) => shortcut.action === action)?.keys;
}

/** The actions in the list grouped by scope, in list order; a scope with no shortcuts gets []. */
export function actionsByScope(
  shortcuts: readonly Shortcut[],
): Record<Scope, Action[]> {
  const groups: Record<Scope, Action[]> = { global: [], editor: [] };
  for (const shortcut of shortcuts) {
    groups[shortcut.scope].push(shortcut.action);
  }
  return groups;
}
