// The callback a Node-style function takes last: an error, or null and the result.
export type Callback<R> = (error: Error | null, result?: R) => void;

// Callbackify<F>: an async function type turned into one that takes a Callback<R> last.
export type Callbackify<F> = unknown;
