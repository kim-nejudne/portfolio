export type Level = 'info' | 'warning' | 'error';
export type Alert = { title: string; level: Level; dismissAfter?: number };

// Each step may be called once, and build only once title and level are set.
// Change the return types (alert's too) and write the bodies.
export class AlertBuilder<T extends object> {
  readonly #alert: T;

  constructor(alert: T) {
    this.#alert = alert;
  }

  title(title: string): AlertBuilder<T> {
    throw new Error(`title is not implemented: ${title}`);
  }

  level(level: Level): AlertBuilder<T> {
    throw new Error(`level is not implemented: ${level}`);
  }

  dismissAfter(ms: number): AlertBuilder<T> {
    throw new Error(`dismissAfter is not implemented: ${ms}`);
  }

  build(): T {
    throw new Error('build is not implemented');
  }
}

export const alert = (): AlertBuilder<{}> => new AlertBuilder({});
