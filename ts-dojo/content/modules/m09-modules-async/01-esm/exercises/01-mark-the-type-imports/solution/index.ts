import { type Shape, type Size, area, boundingBox } from './shapes';

/** One line about a shape: its kind, its area to two decimals and its bounding box. */
export function describe(shape: Shape): string {
  const box: Size = boundingBox(shape);
  return `${shape.kind}: area ${area(shape).toFixed(2)}, box ${box.width}x${box.height}`;
}

console.log(describe({ kind: 'circle', radius: 1 }));
console.log(describe({ kind: 'rect', width: 3, height: 2 }));
