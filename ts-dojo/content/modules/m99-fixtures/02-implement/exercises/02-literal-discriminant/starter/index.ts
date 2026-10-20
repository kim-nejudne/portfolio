export type Circle = { kind: string; radius: number };
export type Square = { kind: string; side: number };
export type Shape = Circle | Square;

export function area(shape: Shape): number {
  if (shape.kind === 'circle') {
    return Math.PI * shape.radius ** 2;
  }
  return shape.side ** 2;
}
