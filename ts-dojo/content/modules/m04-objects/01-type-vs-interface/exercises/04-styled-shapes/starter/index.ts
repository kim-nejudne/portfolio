export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

export interface Style {
  fill: string;
  stroke?: string;
}

// Any Shape, together with the properties of Style.
export type StyledShape = Shape;

/** One SVG element for a styled shape, such as `<circle r="5" fill="red" />`. */
export function toSvg(shape: StyledShape): string {
  throw new Error(`not implemented for ${shape.kind}`);
}
