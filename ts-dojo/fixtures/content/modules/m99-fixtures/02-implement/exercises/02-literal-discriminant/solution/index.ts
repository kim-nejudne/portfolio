export type Circle = { kind: 'circle'; radius: number };
export type Square = { kind: 'square'; side: number };
export type Shape = Circle | Square;

export function area(shape: Shape): SquareUnits {
  if (shape.kind === 'circle') {
    return Math.PI * shape.radius ** 2;
  }
  return shape.side ** 2;
}
