/** A CSS length in pixels: '10px', '0.5px', '-2px'. */
export type Length = `${number}px`;

// Shorthand: one to four Lengths separated by single spaces.
export type Shorthand =
  | Length
  | `${Length} ${Length}`
  | `${Length} ${Length} ${Length}`
  | `${Length} ${Length} ${Length} ${Length}`;

// Sides<S>: [top, right, bottom, left] of the shorthand S, as string literal types.
// Each infer before a space stops at the first space, so the longest pattern goes first:
// `${infer T} ${infer R}` would also match three or four lengths.
export type Sides<S extends Shorthand> =
  S extends `${infer T} ${infer R} ${infer B} ${infer L}`
    ? [T, R, B, L]
    : S extends `${infer T} ${infer R} ${infer B}`
      ? [T, R, B, R]
      : S extends `${infer T} ${infer R}`
        ? [T, R, T, R]
        : [S, S, S, S];

export type Box = { top: number; right: number; bottom: number; left: number };

/** The four sides of a padding shorthand, in pixels. */
export function padding(value: Shorthand): Box {
  const [top, right = top, bottom = top, left = right] = value
    .split(' ')
    .map((part) => Number.parseFloat(part));
  return { top, right, bottom, left };
}
