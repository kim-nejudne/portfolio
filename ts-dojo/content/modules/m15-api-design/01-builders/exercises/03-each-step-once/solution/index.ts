export type Level = 'info' | 'warning' | 'error';
export type Alert = { title: string; level: Level; dismissAfter?: number };

// The methods a builder offers: none of the steps already taken, and build only once title
// and level are set.
type Next<T extends object> = Omit<
  AlertBuilder<T>,
  keyof T | (T extends Alert ? never : 'build')
>;

export class AlertBuilder<T extends object> {
  readonly #alert: T;

  constructor(alert: T) {
    this.#alert = alert;
  }

  title(title: string): Next<T & { title: string }> {
    return new AlertBuilder({ ...this.#alert, title });
  }

  level(level: Level): Next<T & { level: Level }> {
    return new AlertBuilder({ ...this.#alert, level });
  }

  dismissAfter(ms: number): Next<T & { dismissAfter: number }> {
    return new AlertBuilder({ ...this.#alert, dismissAfter: ms });
  }

  build(): T {
    return { ...this.#alert };
  }
}

export const alert = (): Next<{}> => new AlertBuilder({});
