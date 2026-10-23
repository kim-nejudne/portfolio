const settings = new Map<string, unknown>([
  ['port', 8080],
  ['host', 'localhost'],
  ['verbose', true],
]);

/** Stores a setting under key. */
export function setSetting(key: string, value: unknown): void {
  settings.set(key, value);
}

/** The setting stored under key, checked by decode. */
export function getSetting<T>(key: string, decode: (value: unknown) => T): T {
  return decode(settings.get(key));
}

/** A decoder: the value if it is a number, else an error. */
export function toNumber(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error(`expected a number, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** A decoder: the value if it is a string, else an error. */
export function toText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`expected a string, got ${JSON.stringify(value)}`);
  }
  return value;
}
