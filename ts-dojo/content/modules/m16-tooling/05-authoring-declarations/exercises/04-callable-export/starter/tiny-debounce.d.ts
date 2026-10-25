// The declarations for tiny-debounce. This file has no import or export of its own, so it is
// a script, and the declare module block describes the package.
declare module 'tiny-debounce' {
  export interface Debounced {
    (...args: unknown[]): void;
  }

  function debounce(fn: Function, wait?: number): Debounced;

  export = debounce;
}
