// The Publish rule (spec: Category page): the store refuses with these problems, and the admin
// page disables **Publish ‹name›** and lists them, so both read the same rule.
import { boxContains } from './geo.js';
import type { Box, Category, Difficulty, LabelStyle, LevelContent } from './types.js';

const LEVEL_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The box and label style the draft uses: `draftMeta` when set, else the live ones. */
export function draftBoxAndStyle(c: Category): { box: Box; labelStyle: LabelStyle } {
  return c.draftMeta ?? { box: c.box, labelStyle: c.labelStyle };
}

/**
 * Why Publish would refuse, empty when it may go ahead. Every place that would be live afterwards
 * is checked against the draft box, not just the draft levels.
 */
export function publishProblems(c: Category): string[] {
  const drafts = Object.entries(c.draft) as [Difficulty, LevelContent][];
  if (drafts.length === 0 && !c.draftMeta) return ['Nothing to publish'];
  const problems = drafts
    .filter(([, level]) => !level.reviewed)
    .map(([d]) => `Review ${LEVEL_NAMES[d]} first`);
  const { box } = draftBoxAndStyle(c);
  for (const [d, level] of Object.entries({ ...c.live, ...c.draft }) as [
    Difficulty,
    LevelContent,
  ][]) {
    for (const p of level.places) {
      const where = `${p.name} (${LEVEL_NAMES[d]})`;
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng))
        problems.push(`${where} has no coordinates`);
      else if (!boxContains(box, p)) problems.push(`${where} lies outside the box`);
      if (p.kind === 'landmark' && !p.photo) problems.push(`${where} has no photo`);
    }
  }
  return problems;
}
