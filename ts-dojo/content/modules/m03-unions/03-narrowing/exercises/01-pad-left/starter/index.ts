/** `input` with padding in front: a number of spaces, or a string as it is. */
export function padLeft(padding: number | string, input: string): string {
  return ' '.repeat(padding) + input;
}
