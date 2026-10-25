// What a lesson.mdx declares, read without rendering it (spec §3 lesson.mdx; §1 Lesson anatomy):
// besides the frontmatter, fences and `<Predict>` props the build and the lint use, the
// headings (the §1 theory order, checked for the course by curriculum.test.ts) and the links:
// Markdown links (Further reading) and `<Lesson id>` links (which must name a lesson).
import { describe, expect, it } from 'vitest';
import { analyzeLesson, LessonAnalysisError } from './analyze';

const LESSON = `---
id: m/l
title: T
minutes: 5
---

## Concept

Builds on <Lesson id="m01-types/01-annotations-and-inference" />.

\`\`\`ts twoslash
const a = 1;
//    ^?
\`\`\`

## Examples

### A sub-heading with \`code\`

\`\`\`ts run
console.log(1);
\`\`\`

## Check yourself

<Predict id="q" question="Q" options={['a', 'b']} answer={0} explanation="E" />

## Further reading

- [Everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html), and
  <Lesson id="m03-unions/03-narrowing" />
`;

describe('analyzeLesson', () => {
  it('records every heading with its depth, plain text and line', async () => {
    const analysis = await analyzeLesson(LESSON, 'x/lesson.mdx');
    expect(analysis.headings).toEqual([
      { depth: 2, text: 'Concept', line: 7 },
      { depth: 2, text: 'Examples', line: 16 },
      { depth: 3, text: 'A sub-heading with code', line: 18 },
      { depth: 2, text: 'Check yourself', line: 24 },
      { depth: 2, text: 'Further reading', line: 28 },
    ]);
  });

  it('records Markdown links and <Lesson id> links with their lines', async () => {
    const analysis = await analyzeLesson(LESSON, 'x/lesson.mdx');
    expect(analysis.links).toEqual([
      {
        url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html',
        line: 30,
      },
    ]);
    expect(analysis.lessonLinks).toEqual([
      { id: 'm01-types/01-annotations-and-inference', line: 9 },
      { id: 'm03-unions/03-narrowing', line: 31 },
    ]);
  });

  it('keeps the fences and the questions it already read', async () => {
    const analysis = await analyzeLesson(LESSON, 'x/lesson.mdx');
    expect(analysis.fences.map((f) => [f.kind, f.line])).toEqual([
      ['twoslash', 11],
      ['run', 20],
    ]);
    expect(analysis.predicts.map((p) => [p.props.id, p.line])).toEqual([
      ['q', 26],
    ]);
  });

  it('records the paragraphs that open with bold text (the Pitfalls items), with their lines', async () => {
    const analysis = await analyzeLesson(
      `---\nid: m/l\ntitle: T\nminutes: 5\n---\n\n## Pitfalls\n\n**A first mistake.** Its text.\n\n\`\`\`ts run errors\nconst a: number = '1';\n\`\`\`\n\nPlain prose, **bold** later.\n\n**A second \`code\` mistake.** More.\n`,
      'x/lesson.mdx',
    );
    expect(analysis.leads).toEqual([
      { text: 'A first mistake.', line: 9 },
      { text: 'A second code mistake.', line: 17 },
    ]);
  });

  it('refuses a <Lesson> whose id is not a written-out string', async () => {
    await expect(
      analyzeLesson(
        LESSON.replace(
          '<Lesson id="m03-unions/03-narrowing" />',
          '<Lesson id={next} />',
        ),
        'x/lesson.mdx',
      ),
    ).rejects.toThrow(LessonAnalysisError);
  });
});
