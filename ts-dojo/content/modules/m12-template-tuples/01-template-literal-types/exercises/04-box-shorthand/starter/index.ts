/** A CSS length in pixels: '10px', '0.5px', '-2px'. */
export type Length = `${number}px`;

// Shorthand: one to four Lengths separated by single spaces.
export type Shorthand = string;

// Sides<S>: [top, right, bottom, left] of the shorthand S, as string literal types.
export type Sides<S extends Shorthand> = [string, string, string, string];

export type Box = { top: number; right: number; bottom: number; left: number };

/** The four sides of a padding shorthand, in pixels. */
export function padding(value: Shorthand): Box {
  throw new Error(`not implemented: ${value}`);
}
