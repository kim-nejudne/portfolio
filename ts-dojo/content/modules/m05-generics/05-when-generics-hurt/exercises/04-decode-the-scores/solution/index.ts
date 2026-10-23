/** Turns an unknown value into a T, or throws. */
export type Decoder<T> = (value: unknown) => T;

/** Parses JSON and checks the result with decode. */
export function parseJson<T>(text: string, decode: Decoder<T>): T {
  return decode(JSON.parse(text));
}

/** A decoder for a score: an integer from 0 to 100. */
export const toScore: Decoder<number> = (value) => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(`expected a score, got ${JSON.stringify(value)}`);
  }
  return value;
};

/** A decoder for arrays whose items all pass item. */
export function arrayOf<T>(item: Decoder<T>): Decoder<T[]> {
  return (value) => {
    if (!Array.isArray(value)) {
      throw new Error(`expected an array, got ${JSON.stringify(value)}`);
    }
    return value.map((element) => item(element));
  };
}

/** The scores in a JSON file that holds an array of scores. */
export function loadScores(text: string): number[] {
  return parseJson(text, arrayOf(toScore));
}
