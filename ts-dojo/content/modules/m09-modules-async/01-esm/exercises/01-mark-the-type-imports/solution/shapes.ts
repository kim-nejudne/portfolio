// The shapes and what to measure about them. This file is right as it is: leave it alone.
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rect'; width: number; height: number };

export interface Size {
  width: number;
  height: number;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    case 'rect':
      return shape.width * shape.height;
  }
}

/** The smallest axis-aligned box the shape fits in. */
export function boundingBox(shape: Shape): Size {
  switch (shape.kind) {
    case 'circle':
      return { width: 2 * shape.radius, height: 2 * shape.radius };
    case 'square':
      return { width: shape.side, height: shape.side };
    case 'rect':
      return { width: shape.width, height: shape.height };
  }
}
