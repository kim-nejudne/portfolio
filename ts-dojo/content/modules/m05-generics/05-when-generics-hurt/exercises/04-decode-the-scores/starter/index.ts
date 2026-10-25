/** Turns an unknown value into a T, or throws. */
export type Decoder<T> = (value: unknown) => T;

/** Parses JSON. The caller picks T, and nothing checks it. */
export function parseJson<T>(text: string): T {
  return JSON.parse(text);
}

/** A decoder for a score: an integer from 0 to 100. */
export const toScore: Decoder<number> = (value) => {
  throw new Error(`not implemented for ${JSON.stringify(value)}`);
};

/** A decoder for arrays whose items all pass item. */
export function arrayOf<T>(item: Decoder<T>): Decoder<T[]> {
  throw new Error(`not implemented for ${item.name}`);
}

/** The scores in a JSON file that holds an array of scores. */
export function loadScores(text: string): number[] {
  return parseJson<number[]>(text);
}
