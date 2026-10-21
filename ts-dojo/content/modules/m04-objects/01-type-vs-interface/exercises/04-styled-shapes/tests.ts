import type { Alike, Expect } from '@dojo/type-utils';
import { toSvg, type StyledShape } from './index';

// Interfaces merge (see the lesson), so this adds `opacity` to the Style in index.ts. A type
// built on Style picks it up; a copy of Style's properties doesn't.
declare module './index' {
  interface Style {
    opacity?: number;
  }
}

type cases = [
  Expect<
    Alike<
      Extract<StyledShape, { kind: 'circle' }>,
      {
        kind: 'circle';
        radius: number;
        fill: string;
        stroke?: string;
        opacity?: number;
      }
    >
  >, // a styled circle is a circle with a style
  Expect<
    Alike<
      Extract<StyledShape, { kind: 'rect' }>,
      {
        kind: 'rect';
        width: number;
        height: number;
        fill: string;
        stroke?: string;
        opacity?: number;
      }
    >
  >, // a styled rect is a rect with a style
];

// @ts-expect-error
const bare: StyledShape = { kind: 'circle', radius: 1 }; // a styled shape needs a fill

export { bare };

// Every input goes through a variable: the starter's StyledShape is only Shape, and a fresh
// object literal with a `fill` would not compile against it.
const redCircle = { kind: 'circle', radius: 5, fill: 'red' } as const;
const outlinedCircle = {
  kind: 'circle',
  radius: 1,
  fill: 'none',
  stroke: 'black',
} as const;
const blueRect = { kind: 'rect', width: 2, height: 3, fill: 'blue' } as const;
const outlinedRect = {
  kind: 'rect',
  width: 10,
  height: 4,
  fill: 'white',
  stroke: 'gray',
} as const;
const unsetStroke = {
  kind: 'rect',
  width: 1,
  height: 1,
  fill: 'red',
  stroke: undefined,
} as const;
const emptyStroke = {
  kind: 'circle',
  radius: 2,
  fill: 'red',
  stroke: '',
} as const;

test('a circle', () => {
  expect(toSvg(redCircle)).toBe('<circle r="5" fill="red" />');
});

test('a circle with a stroke', () => {
  expect(toSvg(outlinedCircle)).toBe(
    '<circle r="1" fill="none" stroke="black" />',
  );
});

test('a rect', () => {
  expect(toSvg(blueRect)).toBe('<rect width="2" height="3" fill="blue" />');
});

test('a rect with a stroke', () => {
  expect(toSvg(outlinedRect)).toBe(
    '<rect width="10" height="4" fill="white" stroke="gray" />',
  );
});

test('a stroke set to undefined is left out', () => {
  expect(toSvg(unsetStroke)).toBe('<rect width="1" height="1" fill="red" />');
});

test('an empty stroke is still set', () => {
  expect(toSvg(emptyStroke)).toBe('<circle r="2" fill="red" stroke="" />');
});

test('circles of radius 1 to 20', () => {
  for (let radius = 1; radius <= 20; radius++) {
    const fill = radius % 2 === 0 ? 'teal' : 'gold';
    const circle = { kind: 'circle', radius, fill } as const;
    expect(toSvg(circle)).toBe(`<circle r="${radius}" fill="${fill}" />`);
  }
});

test('rects of several sizes, with and without a stroke', () => {
  const sizes = [
    [3, 7],
    [12, 5],
    [8, 8],
    [1, 30],
  ] as const;
  for (const [width, height] of sizes) {
    const fill = `#${width}${height}`;
    const plain = { kind: 'rect', width, height, fill } as const;
    const stroked = { ...plain, stroke: 'navy' };
    expect(toSvg(plain)).toBe(
      `<rect width="${width}" height="${height}" fill="${fill}" />`,
    );
    expect(toSvg(stroked)).toBe(
      `<rect width="${width}" height="${height}" fill="${fill}" stroke="navy" />`,
    );
  }
});
