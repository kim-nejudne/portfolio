export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'triangle'; base: number; height: number };

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    case 'triangle':
      return (shape.base * shape.height) / 2;
    default: {
      const unreachable: never = shape;
      throw new Error(`unhandled shape: ${JSON.stringify(unreachable)}`);
    }
  }
}

export function label(shape: Shape): string {
  switch (shape.kind) {
    case 'circle':
      return `circle, radius ${shape.radius}`;
    case 'square':
      return `square, side ${shape.side}`;
    case 'triangle':
      return `triangle, base ${shape.base}, height ${shape.height}`;
    default: {
      const unreachable: never = shape;
      throw new Error(`unhandled shape: ${JSON.stringify(unreachable)}`);
    }
  }
}
