export type Listener<Args extends unknown[]> = (...args: Args) => void;

export class Emitter<E> {
  on(type: keyof E, listener: Listener<unknown[]>): () => void {
    throw new Error(`on is not implemented: ${String(type)}, ${listener}`);
  }

  once(type: keyof E, listener: Listener<unknown[]>): () => void {
    throw new Error(`once is not implemented: ${String(type)}, ${listener}`);
  }

  emit(type: keyof E, ...args: unknown[]): number {
    throw new Error(`emit is not implemented: ${String(type)}, ${args}`);
  }
}
