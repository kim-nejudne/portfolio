// What `/repl` shows on the first visit, when the §7 `buffers` table is empty: two buffers
// that exercise the type feedback (`^?`, quick info and `gd` across files) and `:w`. They are
// ordinary scratch buffers afterwards: edited, autosaved, deletable with `:bd`.
export const WELCOME_BUFFERS: readonly { name: string; text: string }[] = [
  {
    name: 'index.ts',
    text: `import { area, type Shape } from './shapes';

const circle: Shape = { kind: 'circle', radius: 2 };
const size = area(circle);
//    ^?

const unit = 'cm';
console.log(size.toFixed(2), unit);
`,
  },
  {
    name: 'shapes.ts',
    text: `export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

/** The area of a shape, in square units. */
export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
  }
}
`,
  },
];
