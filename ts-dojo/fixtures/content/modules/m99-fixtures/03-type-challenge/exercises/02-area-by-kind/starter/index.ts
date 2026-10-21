export type Shape =
  { kind: 'circle'; radius: number } | { kind: 'square'; side: number };

export function describe(shape: Shape): string {
  throw new Error(`not implemented for ${shape.kind}`);
}
