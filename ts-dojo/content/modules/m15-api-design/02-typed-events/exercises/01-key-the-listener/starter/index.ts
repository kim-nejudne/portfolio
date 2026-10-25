export interface ShopEvents {
  login: { user: string };
  addToCart: { sku: string; quantity: number };
  checkout: { total: number };
}

export class Emitter<E> {
  readonly #listeners: { [K in keyof E]?: Array<(payload: E[K]) => void> } = {};

  on(type: keyof E, listener: (payload: E[keyof E]) => void): void {
    (this.#listeners[type] ??= []).push(listener);
  }

  emit(type: keyof E, payload: E[keyof E]): void {
    for (const listener of this.#listeners[type] ?? []) listener(payload);
  }
}

export const shop = new Emitter<ShopEvents>();
export const log: string[] = [];

shop.on('login', (payload) => log.push(`hello ${payload.user}`));
shop.on('addToCart', (payload) =>
  log.push(`${payload.quantity} x ${payload.sku}`),
);
shop.on('checkout', (payload) => log.push(`paid ${payload.total}`));
