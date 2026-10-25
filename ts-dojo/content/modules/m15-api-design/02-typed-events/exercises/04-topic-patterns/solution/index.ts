export type Message<T, K extends keyof T = keyof T> = {
  [P in keyof T]: { topic: P; payload: T[P] };
}[K];

type NamespaceOf<K> = K extends `${infer N}/${string}` ? N : never;

// Every topic of T, and `<namespace>/*` for each namespace the topics use.
export type Pattern<T> = (keyof T & string) | `${NamespaceOf<keyof T>}/*`;

// The topics that the pattern P receives.
export type Matching<T, P> = P extends `${infer N}/*`
  ? Extract<keyof T, `${N}/${string}`>
  : Extract<P, keyof T>;

// Whether the message's topic is the pattern, or lies in the pattern's namespace.
export function matches<T, P extends string>(
  pattern: P,
  message: Message<T>,
): message is Message<T, Matching<T, P>> {
  const topic = String(message.topic);
  return pattern.endsWith('/*')
    ? topic.startsWith(pattern.slice(0, -1))
    : topic === pattern;
}

export class Broker<T> {
  readonly #listeners = new Set<(message: Message<T>) => void>();

  publish<K extends keyof T>(topic: K, payload: T[K]): void {
    const message: Message<T, K> = { topic, payload };
    for (const listener of [...this.#listeners]) listener(message);
  }

  subscribe<P extends Pattern<T>>(
    pattern: P,
    listener: (message: Message<T, Matching<T, P>>) => void,
  ): () => void {
    const deliver = (message: Message<T>) => {
      if (matches(pattern, message)) listener(message);
    };
    this.#listeners.add(deliver);
    return () => {
      this.#listeners.delete(deliver);
    };
  }
}
