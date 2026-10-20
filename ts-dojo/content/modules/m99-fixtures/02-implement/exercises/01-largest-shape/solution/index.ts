export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; width: number; height: number };

/** The area of one shape. Handle every kind, and prove it with a `never` check. */
export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    case 'rect':
      return shape.width * shape.height;
    default: {
      const unreachable: never = shape;
      throw new Error(`unhandled shape: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** The shape with the largest area, or undefined for an empty list. */
export function largest(shapes: readonly Shape[]): Shape | undefined {
  let best: Shape | undefined;
  for (const shape of shapes) {
    if (best === undefined || area(shape) > area(best)) {
      best = shape;
    }
  }
  return best;
}
