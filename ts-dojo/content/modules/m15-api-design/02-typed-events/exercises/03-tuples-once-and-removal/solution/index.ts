export type Listener<Args extends unknown[]> = (...args: Args) => void;

export class Emitter<E extends { [K in keyof E]: unknown[] }> {
  readonly #listeners: { [K in keyof E]?: Set<Listener<E[K]>> } = {};

  on<K extends keyof E>(type: K, listener: Listener<E[K]>): () => void {
    (this.#listeners[type] ??= new Set()).add(listener);
    return () => {
      this.#listeners[type]?.delete(listener);
    };
  }

  once<K extends keyof E>(type: K, listener: Listener<E[K]>): () => void {
    const off = this.on(type, (...args) => {
      off();
      listener(...args);
    });
    return off;
  }

  emit<K extends keyof E>(type: K, ...args: E[K]): number {
    const listeners = [...(this.#listeners[type] ?? [])];
    for (const listener of listeners) listener(...args);
    return listeners.length;
  }
}
