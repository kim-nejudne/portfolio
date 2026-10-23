// A small translation module. This file is right as it is: leave it alone.

/**
 * Apps register the type of their messages here, with module augmentation:
 * `interface Register { messages: ... }` inside `declare module './i18n'`.
 */
export interface Register {}

/** The registered messages, or a table of any strings until an app registers some. */
type Messages = Register extends { messages: infer M }
  ? M
  : Record<string, string>;

/** The keys t accepts. */
export type MessageKey = keyof Messages & string;

/** A complete translation: a text for every key. */
export type Catalog = Record<MessageKey, string>;

let current: Catalog | undefined;

/** Switches the language. */
export function use(catalog: Catalog): void {
  current = catalog;
}

/** The text for a key, with {count} replaced when a count is given. */
export function t(key: MessageKey, count?: number): string {
  if (current === undefined) throw new Error('call use(catalog) first');
  const text = current[key];
  return count === undefined ? text : text.replace('{count}', String(count));
}
