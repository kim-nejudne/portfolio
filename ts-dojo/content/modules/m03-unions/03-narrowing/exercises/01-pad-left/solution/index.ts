/** `input` with padding in front: a number of spaces, or a string as it is. */
export function padLeft(padding: number | string, input: string): string {
  if (typeof padding === 'number') {
    return ' '.repeat(padding) + input;
  } else {
    return padding + input;
  }
}
