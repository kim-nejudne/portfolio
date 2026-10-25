/** Takes a number and says whether it passes. */
export type Predicate = (value: number) => boolean;

/** Takes the running total and the next value, and returns the new total. */
export type Reducer = (total: number, value: number) => number;

/** Takes a listener, which is called with a string message, and returns nothing. */
export type Subscribe = (listener: (message: string) => void) => void;

/** Takes a prefix and returns a function that puts it in front of a text. */
export type Prefixer = (prefix: string) => (text: string) => string;
