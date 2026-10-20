// The roadmap's prerequisite edges (§6 Roadmap: "SVG curves between cards. An edge between
// neighbours in the same band is implied and not drawn, to keep the map readable"): which
// edges are drawn, and each one's curve between the two cards' boxes, measured in the map's own
// coordinates. A prerequisite above its module joins its bottom centre to the module's top
// centre; one below, its top to the module's bottom; two cards in one row join bottom to
// bottom with an arc under the row. Pure.
import type { RoadmapRegistry } from './model';

export interface Edge {
  /** The prerequisite. */
  from: string;
  /** The module that needs it. */
  to: string;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** How far a same-row arc dips under the cards. */
export const ARC_DEPTH = 32;

export function roadmapEdges(registry: RoadmapRegistry): Edge[] {
  const band = new Map<string, { tier: number; index: number }>();
  registry.tiers.forEach((tier, t) => {
    tier.modules.forEach((id, index) => band.set(id, { tier: t, index }));
  });
  const edges: Edge[] = [];
  for (const tier of registry.tiers) {
    for (const to of tier.modules) {
      for (const from of registry.module(to)?.prerequisites ?? []) {
        const a = band.get(from);
        const b = band.get(to);
        if (a === undefined || b === undefined) continue;
        if (a.tier === b.tier && Math.abs(a.index - b.index) === 1) continue;
        edges.push({ from, to });
      }
    }
  }
  return edges;
}

const centre = (box: Box): number => box.x + box.width / 2;
const bottom = (box: Box): number => box.y + box.height;

export function edgeEnds(
  from: Box,
  to: Box,
): { start: Point; end: Point; sameRow: boolean } {
  if (bottom(from) <= to.y) {
    return {
      start: { x: centre(from), y: bottom(from) },
      end: { x: centre(to), y: to.y },
      sameRow: false,
    };
  }
  if (from.y >= bottom(to)) {
    return {
      start: { x: centre(from), y: from.y },
      end: { x: centre(to), y: bottom(to) },
      sameRow: false,
    };
  }
  return {
    start: { x: centre(from), y: bottom(from) },
    end: { x: centre(to), y: bottom(to) },
    sameRow: true,
  };
}

const n = (value: number): string => String(Math.round(value * 10) / 10);

export function edgePath(from: Box, to: Box): string {
  const { start, end, sameRow } = edgeEnds(from, to);
  const [c1, c2] = sameRow
    ? [
        { x: start.x, y: Math.max(start.y, end.y) + ARC_DEPTH },
        { x: end.x, y: Math.max(start.y, end.y) + ARC_DEPTH },
      ]
    : [
        { x: start.x, y: (start.y + end.y) / 2 },
        { x: end.x, y: (start.y + end.y) / 2 },
      ];
  return `M ${n(start.x)} ${n(start.y)} C ${n(c1.x)} ${n(c1.y)} ${n(c2.x)} ${n(c2.y)} ${n(end.x)} ${n(end.y)}`;
}
