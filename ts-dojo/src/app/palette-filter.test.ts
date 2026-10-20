// The palette's matching (§6 Command palette: "One list: lessons by title and tags, exercises by
// title, ex commands by name", fuzzy-matched). A command's name beats a word in its description,
// so `next` selects `:next` and not `:hint` ("Reveals the next hint"); an exact name beats a
// variant (`practice` → `:practice` over `:layout practice`); titles match lessons and
// exercises; any subsequence still matches, ranked last.
import { describe, expect, it } from 'vitest';
import { paletteScore } from './palette-filter';

const command =
  (label: string, aliases: string[], description: string) => (search: string) =>
    paletteScore(label, search, [...aliases, description]);
const next = command(
  ':next',
  [':n'],
  'Next or previous exercise; past the last, the next lesson.',
);
const hint = command(':hint', [], 'Reveals the next hint.');
const lessonNext = command(
  ':lesson next',
  [],
  'Next or previous lesson directly.',
);
const practice = command(':practice', [], 'Focuses that pane.');
const layoutPractice = command(
  ':layout practice',
  [],
  'Two panes, or one full width.',
);
const help = command(':help', [':h'], 'The keyboard help overlay.');
const prev = command(
  ':prev',
  [':N'],
  'Next or previous exercise; past the last, the next lesson.',
);
const lesson = (search: string) =>
  paletteScore('lesson m99-fixtures/03-type-challenge', search, [
    'Describing alternatives as a type',
    'fixture',
    'type-challenge',
  ]);

describe('paletteScore', () => {
  it('ranks a command by its name above a word in another command’s description', () => {
    expect(next('next')).toBeGreaterThan(hint('next'));
    expect(next('next')).toBeGreaterThan(lessonNext('next'));
    expect(lessonNext('next')).toBeGreaterThan(hint('next'));
    expect(next('n')).toBeGreaterThan(prev('n'));
    expect(next(':next')).toBe(next('next'));
  });

  it('ranks the exact name above a variant that contains it', () => {
    expect(practice('practice')).toBeGreaterThan(layoutPractice('practice'));
    expect(help('help')).toBeGreaterThan(lesson('help'));
  });

  it('matches lessons by title and tags, and descriptions by words', () => {
    expect(lesson('describing')).toBeGreaterThan(0);
    expect(lesson('describing')).toBeGreaterThan(help('describing'));
    expect(lesson('fixture')).toBeGreaterThan(0);
    expect(help('keyboard help')).toBeGreaterThan(0);
  });

  it('keeps any subsequence as a weak match and drops the rest', () => {
    const weak = help('hlp');
    expect(weak).toBeGreaterThan(0);
    expect(weak).toBeLessThan(lesson('describing'));
    expect(help('zzz')).toBe(0);
    expect(help('')).toBe(1);
  });
});
