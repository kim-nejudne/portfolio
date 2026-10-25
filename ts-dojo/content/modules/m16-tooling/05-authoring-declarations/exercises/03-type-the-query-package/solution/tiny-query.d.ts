// The declarations for tiny-query. This file has no import or export of its
// own, so it is a script, and the declare module block describes the package.
declare module 'tiny-query' {
  export interface ParseOptions {
    arrays?: boolean;
  }

  export function parse(
    query: string,
    options: { arrays: true },
  ): Record<string, string[]>;
  export function parse(
    query: string,
    options?: { arrays?: false },
  ): Record<string, string>;
  export function parse(
    query: string,
    options?: ParseOptions,
  ): Record<string, string> | Record<string, string[]>;

  export function pick<T, K extends keyof T>(
    params: T,
    ...keys: K[]
  ): Pick<T, K>;
}
