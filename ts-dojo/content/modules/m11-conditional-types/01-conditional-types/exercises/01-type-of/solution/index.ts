// TypeOf<T>: what `typeof` gives for a value of type T, from 'string' to 'object'.
// Functions and classes give 'function'; everything else, null included, gives 'object'.
export type TypeOf<T> = T extends string
  ? 'string'
  : T extends number
    ? 'number'
    : T extends bigint
      ? 'bigint'
      : T extends boolean
        ? 'boolean'
        : T extends symbol
          ? 'symbol'
          : T extends undefined
            ? 'undefined'
            : // Every function type and every class (a constructor type) is assignable to Function.
              T extends Function
              ? 'function'
              : 'object';
