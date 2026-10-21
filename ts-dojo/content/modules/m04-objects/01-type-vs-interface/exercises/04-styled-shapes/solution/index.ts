export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

export interface Style {
  fill: string;
  stroke?: string;
}

// Any Shape, together with the properties of Style.
export type StyledShape = Shape & Style;

function styleAttributes(style: Style): string {
  return style.stroke === undefined
    ? `fill="${style.fill}"`
    : `fill="${style.fill}" stroke="${style.stroke}"`;
}

/** One SVG element for a styled shape, such as `<circle r="5" fill="red" />`. */
export function toSvg(shape: StyledShape): string {
  switch (shape.kind) {
    case 'circle':
      return `<circle r="${shape.radius}" ${styleAttributes(shape)} />`;
    case 'rect':
      return `<rect width="${shape.width}" height="${shape.height}" ${styleAttributes(shape)} />`;
  }
}
