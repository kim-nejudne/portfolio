// The declarations for tiny-debounce. This file has no import or export of its own, so it is
// a script, and the declare module block describes the package.
declare module 'tiny-debounce' {
  function debounce<Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    wait?: number,
  ): debounce.Debounced<Args>;

  namespace debounce {
    interface Debounced<Args extends unknown[]> {
      (...args: Args): void;
      cancel(): void;
    }

    let defaultWait: number;
  }

  export = debounce;
}
