// §6 Roadmap: "Prerequisite edges are SVG curves between cards. An edge between neighbours in
// the same band is implied and not drawn, to keep the map readable." Which edges are drawn,
// and where a curve starts and ends on the two cards' boxes. Pure.
import { describe, expect, it } from 'vitest';
import { edgeEnds, edgePath, roadmapEdges, type Box } from './edges';
import type { RoadmapRegistry } from './model';

const REGISTRY: RoadmapRegistry = {
  tiers: [
    { id: 't1', title: 'One', modules: ['a', 'b', 'c'] },
    { id: 't2', title: 'Two', modules: ['d'] },
  ],
  module: (id) =>
    ({
      a: { title: 'A', lessons: [], prerequisites: [] },
      // Neighbour of a in the same band: implied.
      b: { title: 'B', lessons: [], prerequisites: ['a'] },
      // Same band but not a neighbour of a: drawn.
      c: { title: 'C', lessons: [], prerequisites: ['a', 'missing'] },
      d: { title: 'D', lessons: [], prerequisites: ['a', 'b'] },
    })[id],
  lesson: () => undefined,
};

describe('roadmapEdges', () => {
  it('draws every prerequisite but a same-band neighbour, and skips unknown modules', () => {
    expect(roadmapEdges(REGISTRY)).toEqual([
      { from: 'a', to: 'c' },
      { from: 'a', to: 'd' },
      { from: 'b', to: 'd' },
    ]);
  });
});

describe('edgeEnds and edgePath', () => {
  const upper: Box = { x: 0, y: 0, width: 100, height: 40 };
  const lower: Box = { x: 200, y: 100, width: 100, height: 40 };
  const sameRow: Box = { x: 400, y: 0, width: 100, height: 40 };

  it('runs from the bottom centre of the upper card to the top centre of the lower one', () => {
    expect(edgeEnds(upper, lower)).toEqual({
      start: { x: 50, y: 40 },
      end: { x: 250, y: 100 },
      sameRow: false,
    });
    // A prerequisite below its module: from its top to the module's bottom.
    expect(edgeEnds(lower, upper)).toEqual({
      start: { x: 250, y: 100 },
      end: { x: 50, y: 40 },
      sameRow: false,
    });
  });

  it('joins two cards of one row bottom to bottom, arcing under the row', () => {
    expect(edgeEnds(upper, sameRow)).toEqual({
      start: { x: 50, y: 40 },
      end: { x: 450, y: 40 },
      sameRow: true,
    });
    expect(edgePath(upper, sameRow)).toBe('M 50 40 C 50 72 450 72 450 40');
  });

  it('is a cubic curve between the two ends', () => {
    expect(edgePath(upper, lower)).toBe('M 50 40 C 50 70 250 70 250 100');
  });
});
