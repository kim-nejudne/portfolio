export type Shape =
  { kind: 'circle'; radius: number } | { kind: 'square'; side: number };

export function describe(shape: Shape): string {
  if (shape.kind === 'circle') return `circle r=${shape.radius}`;
  return `square s=${shape.side}`;
}
