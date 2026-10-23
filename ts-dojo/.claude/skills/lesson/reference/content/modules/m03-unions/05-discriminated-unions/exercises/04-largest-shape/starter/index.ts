export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; width: number; height: number };

/** The area of one shape. Handle every kind, and prove it with a `never` check. */
export function area(shape: Shape): number {
  throw new Error(`not implemented for ${shape.kind}`);
}

/** The shape with the largest area, the first of equals, or undefined for an empty list. */
export function largest(shapes: readonly Shape[]): Shape | undefined {
  throw new Error(`not implemented for ${shapes.length} shapes`);
}
