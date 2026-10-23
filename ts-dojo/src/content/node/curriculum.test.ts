// §12 F11 criterion 1: "M00 to M04 exist as §8 lists them: 20 lessons, each with the §1
// structure, at least two exercises (one in M00), at least one `predict`, hints on every editor
// exercise, and at least one `ts twoslash` block." §12 F12: "M05 to M09, 19 core lessons and the
// two optional ones, to the same rules as F11", so 41 lessons in all. Read from the course in content/ with the
// loader the content lint and the build use. The §8 rows below are copied from docs/spec.md
// (titles with their code backticks dropped; minutes as §8 gives them). What no test can judge
// (accuracy, progression, hints that nudge) is the content-reviewer agent's.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isEditorExercise,
  type Exercise,
  type Lesson,
  type Registry,
} from '../build-registry';
import { shownText } from '../inline-code';
import type { LessonAnalysis } from './analyze';
import { loadContent, type LoadedContent } from './load';
import { createRenderer, type Renderer } from './mdx';
import { COURSE_CONTENT } from './roots';

type Row = [folder: string, title: string, minutes: number];

interface ModuleRow {
  id: string;
  title: string;
  prerequisites: string[];
  lessons: Row[];
}

const TIERS: { id: string; title: string; modules: ModuleRow[] }[] = [
  {
    id: 't0',
    title: 'Orientation',
    modules: [
      {
        id: 'm00-orientation',
        title: 'Orientation',
        prerequisites: [],
        lessons: [
          [
            '01-why-typescript',
            'Why TypeScript, and what the compiler does: erasure, no runtime types, tsc vs bundlers, where TS 7 fits',
            10,
          ],
          [
            '02-the-dojo',
            'The dojo: roadmap, lessons, exercises, how passing works, hints and solutions',
            10,
          ],
          [
            '03-vim-in-the-dojo',
            'Vim in this app: the shipped vimrc, ex commands, K, ]d, gd, ^?',
            15,
          ],
        ],
      },
    ],
  },
  {
    id: 't1',
    title: 'Foundations',
    modules: [
      {
        id: 'm01-types',
        title: 'Types and inference',
        prerequisites: ['m00-orientation'],
        lessons: [
          [
            '01-annotations-and-inference',
            'Annotations and inference: when to write a type and when not to',
            15,
          ],
          [
            '02-primitives-literals-widening',
            'Primitives, literal types and widening: let vs const, as const preview',
            15,
          ],
          [
            '03-arrays-tuples-objects',
            'Arrays, tuples, objects and readonly; optional properties',
            20,
          ],
          [
            '04-any-unknown-never-void',
            'any, unknown, never and void: what each allows',
            20,
          ],
        ],
      },
      {
        id: 'm02-functions',
        title: 'Functions',
        prerequisites: ['m01-types'],
        lessons: [
          [
            '01-parameters-and-returns',
            'Parameter and return types; optional, default and rest parameters',
            20,
          ],
          [
            '02-function-types-and-callbacks',
            'Function types, callbacks and contextual typing',
            20,
          ],
          [
            '03-void-returns',
            'void returns, undefined vs void, and the callback return rule',
            15,
          ],
        ],
      },
      {
        id: 'm03-unions',
        title: 'Unions and narrowing',
        prerequisites: ['m02-functions'],
        lessons: [
          ['01-union-and-literal-types', 'Union and literal types', 15],
          [
            '02-null-undefined-strict',
            'null, undefined and strictNullChecks',
            15,
          ],
          [
            '03-narrowing',
            'Narrowing: typeof, truthiness, equality, in, instanceof',
            20,
          ],
          [
            '04-control-flow-analysis',
            'Control-flow analysis: assignments, early returns, closures, and what breaks narrowing',
            20,
          ],
          [
            '05-discriminated-unions',
            'Discriminated unions and exhaustiveness with never',
            20,
          ],
        ],
      },
      {
        id: 'm04-objects',
        title: 'Object types, interfaces and classes',
        prerequisites: ['m03-unions'],
        lessons: [
          ['01-type-vs-interface', 'type vs interface, and intersections', 20],
          [
            '02-structural-typing',
            'Structural typing and excess property checks',
            20,
          ],
          ['03-index-signatures-and-record', 'Index signatures and Record', 15],
          ['04-enums-vs-as-const', 'Enums vs as const unions', 15],
          [
            '05-classes',
            'Classes I: fields, constructors, public/private/protected, readonly, implements, abstract classes',
            25,
          ],
        ],
      },
    ],
  },
  {
    id: 't2',
    title: 'Intermediate',
    modules: [
      {
        id: 'm05-generics',
        title: 'Generics',
        prerequisites: ['m04-objects'],
        lessons: [
          ['01-generic-functions', 'Generic functions and inference', 20],
          ['02-constraints-and-defaults', 'Constraints and defaults', 20],
          [
            '03-generic-types-and-classes',
            'Generic interfaces, type aliases and classes',
            20,
          ],
          [
            '04-keyof-constraints',
            'keyof constraints and typed property access',
            20,
          ],
          // (opt) in §8; written as an ordinary lesson (Kim, 22 October 2026).
          [
            '05-when-generics-hurt',
            'When generics hurt: over-generic code and the return-type-only smell',
            15,
          ],
        ],
      },
      {
        id: 'm06-type-operators',
        title: 'Type operators and utility types',
        prerequisites: ['m05-generics'],
        lessons: [
          [
            '01-keyof-typeof-indexed-access',
            'keyof, typeof and indexed access types',
            20,
          ],
          [
            '02-utility-types-1',
            'Utility types I: Partial, Required, Readonly, Pick, Omit, Record',
            20,
          ],
          [
            '03-utility-types-2',
            'Utility types II: Exclude, Extract, NonNullable, ReturnType, Parameters, Awaited, InstanceType, ConstructorParameters',
            20,
          ],
          [
            '04-rebuilding-the-utilities',
            'Rebuilding the utilities: a first look at mapped and conditional types',
            20,
          ],
        ],
      },
      {
        id: 'm07-guards',
        title: 'Guards, assertions and exhaustiveness',
        prerequisites: ['m06-type-operators'],
        lessons: [
          [
            '01-type-guards',
            'User-defined type guards (is) and inferred type predicates',
            20,
          ],
          ['02-assertion-functions', 'Assertion functions (asserts)', 15],
          [
            '03-exhaustiveness-and-satisfies',
            'Exhaustive switch, assertNever, satisfies and as const for config',
            25,
          ],
          [
            '04-narrowing-pitfalls',
            'Narrowing pitfalls: callbacks, mutation, array methods and filter',
            15,
          ],
        ],
      },
      {
        id: 'm08-functions-classes',
        title: 'Functions and classes II',
        prerequisites: ['m07-guards'],
        lessons: [
          [
            '01-overloads',
            'Overloads, and when a union or a generic is better',
            20,
          ],
          [
            '02-this-and-callable-types',
            'this parameters, this types, callable and constructable types',
            25,
          ],
          [
            '03-classes-2',
            'Classes II: generic classes, override, accessors, static blocks, parameter properties',
            20,
          ],
          // (opt) in §8; written as an ordinary lesson (Kim, 22 October 2026).
          ['04-mixins', 'Mixins', 15],
        ],
      },
      {
        id: 'm09-modules-async',
        title: 'Modules, declarations and async',
        prerequisites: ['m08-functions-classes'],
        lessons: [
          [
            '01-esm',
            'ESM in TypeScript: import type, export type, verbatimModuleSyntax, isolatedModules',
            20,
          ],
          [
            '02-declaration-files',
            'Declaration files and declare: ambient types and globals',
            20,
          ],
          [
            '03-async',
            'Typing async code: Promise, Awaited, async iterators',
            20,
          ],
          ['04-errors', 'Errors: unknown in catch, Result-style returns', 15],
        ],
      },
    ],
  },
];

/** §1 Lesson anatomy: the theory sections, in this order. */
const SECTIONS = [
  'Concept',
  'Examples',
  'Pitfalls',
  'Check yourself',
  'Further reading',
] as const;
type Section = (typeof SECTIONS)[number];

const MODULES = TIERS.flatMap((tier) => tier.modules);
const LESSONS = MODULES.flatMap((module) =>
  module.lessons.map(([folder, title, minutes]) => ({
    module: module.id,
    id: `${module.id}/${folder}`,
    title,
    minutes,
  })),
);

let content: LoadedContent;
let registry: Registry;
let renderer: Renderer;

beforeAll(async () => {
  content = await loadContent(COURSE_CONTENT);
  registry = content.registry;
  renderer = await createRenderer();
}, 60_000);

afterAll(() => {
  renderer.dispose();
});

function lessonOf(id: string): Lesson {
  const lesson = registry.lesson(id);
  if (lesson === undefined) throw new Error(`no lesson ${id}`);
  return lesson;
}

function analysisOf(lesson: Lesson): LessonAnalysis {
  const analysis = content.analyses[lesson.path];
  if (analysis === undefined) throw new Error(`no analysis of ${lesson.path}`);
  return analysis;
}

function exercisesOf(lesson: Lesson): Exercise[] {
  return lesson.exercises.map((id) => {
    const exercise = registry.exercise(id);
    if (exercise === undefined) throw new Error(`no exercise ${id}`);
    return exercise;
  });
}

/** The §1 section (h2) a line falls under; null before the first one. */
function sectionAt(analysis: LessonAnalysis, line: number): string | null {
  let section: string | null = null;
  for (const heading of analysis.headings) {
    if (heading.depth === 2 && heading.line < line) section = heading.text;
  }
  return section;
}

function inSection<T extends { line: number }>(
  analysis: LessonAnalysis,
  items: T[],
  section: Section,
): T[] {
  return items.filter((item) => sectionAt(analysis, item.line) === section);
}

describe('§12 F11 and F12: the course in content/ is Tiers 0 to 2 as §8 lists them', () => {
  it('loads with no structural problem', () => {
    expect(content.problems).toEqual([]);
  });

  it("the roadmap has §8's tiers t0, t1 and t2, in order", () => {
    expect(registry.tiers).toEqual(
      TIERS.map((tier) => ({
        id: tier.id,
        title: tier.title,
        modules: tier.modules.map((m) => m.id),
      })),
    );
  });

  it("41 lessons in all: F11's 20, F12's 19 core and two optional", () => {
    expect(LESSONS).toHaveLength(41);
    expect(registry.lessons.map((l) => l.id)).toEqual(LESSONS.map((l) => l.id));
  });

  it.each(MODULES)(
    '$id matches §8: title, prerequisites and lessons in order',
    (row) => {
      const module = registry.module(row.id);
      expect(module).toMatchObject({
        title: row.title,
        prerequisites: row.prerequisites,
        lessons: row.lessons.map(([folder]) => `${row.id}/${folder}`),
      });
    },
  );

  it.each(LESSONS)('$id matches its §8 row: title and minutes', (row) => {
    expect(lessonOf(row.id)).toMatchObject({
      title: row.title,
      minutes: row.minutes,
    });
  });
});

describe.each(LESSONS)('§12 F11 and F12: $id', (row) => {
  it('has the §1 structure: the five theory sections in order, 2–5 objectives, runnable examples, two or three pitfalls each with a snippet, 1–3 questions, further reading', () => {
    const lesson = lessonOf(row.id);
    const analysis = analysisOf(lesson);
    expect(
      analysis.headings.filter((h) => h.depth === 2).map((h) => h.text),
    ).toEqual(SECTIONS);
    expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
    expect(lesson.objectives.length).toBeLessThanOrEqual(5);
    expect(
      inSection(analysis, analysis.fences, 'Examples').filter(
        (f) => f.kind === 'run',
      ).length,
      'Examples has a runnable (ts run) block: §1 "Each has Run and Open in REPL"',
    ).toBeGreaterThan(0);
    expect(
      inSection(analysis, analysis.fences, 'Pitfalls').filter(
        (f) => f.kind === 'run-errors',
      ).length,
      'Pitfalls has a ts run errors block',
    ).toBeGreaterThan(0);
    // §1: "the two or three mistakes people make, each with a failing snippet". Each mistake
    // is a paragraph that opens with its bold name; its snippet comes before the next one.
    const mistakes = inSection(analysis, analysis.leads, 'Pitfalls');
    expect(
      mistakes.length,
      'Pitfalls names two or three mistakes',
    ).toBeGreaterThanOrEqual(2);
    expect(mistakes.length).toBeLessThanOrEqual(3);
    const sectionEnd =
      analysis.headings.find(
        (h) => h.depth === 2 && h.text === 'Check yourself',
      )?.line ?? Infinity;
    mistakes.forEach((mistake, index) => {
      const next = mistakes[index + 1]?.line ?? sectionEnd;
      expect(
        analysis.fences.some((f) => f.line > mistake.line && f.line < next),
        `the pitfall "${mistake.text}" has a snippet`,
      ).toBe(true);
    });
    const questions = inSection(analysis, analysis.predicts, 'Check yourself');
    expect(questions, 'every <Predict> is under Check yourself').toHaveLength(
      analysis.predicts.length,
    );
    expect(questions.length).toBeGreaterThanOrEqual(1);
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(
      inSection(analysis, analysis.links, 'Further reading').length,
      'Further reading has a link',
    ).toBeGreaterThan(0);
  });

  it('has at least two exercises (one in M00) and at most five, at least one predict, and 1–3 hints on every editor exercise', () => {
    const exercises = exercisesOf(lessonOf(row.id));
    const least = row.module === 'm00-orientation' ? 1 : 2;
    expect(exercises.length).toBeGreaterThanOrEqual(least);
    expect(exercises.length).toBeLessThanOrEqual(5);
    expect(
      exercises.filter((e) => e.kind === 'predict').length,
    ).toBeGreaterThan(0);
    for (const exercise of exercises.filter(isEditorExercise)) {
      expect(exercise.hints.length, exercise.id).toBeGreaterThanOrEqual(1);
      expect(exercise.hints.length, exercise.id).toBeLessThanOrEqual(3);
    }
  });

  it('shows a failing snippet for its pitfalls: every ts run errors block has a diagnostic', async () => {
    const analysis = analysisOf(lessonOf(row.id));
    for (const fence of analysis.fences.filter(
      (f) => f.kind === 'run-errors',
    )) {
      expect(
        (await renderer.check(fence.code)).length,
        `${row.id}: the ts run errors block at line ${String(fence.line)}`,
      ).toBeGreaterThan(0);
    }
  });

  it('has a ts twoslash block', () => {
    const analysis = analysisOf(lessonOf(row.id));
    expect(analysis.fences.some((f) => f.kind === 'twoslash')).toBe(true);
  });

  it('writes its hints and questions as plain text with code spans, no lone backtick (src/content/inline-code.ts)', () => {
    const lesson = lessonOf(row.id);
    const exercises = exercisesOf(lesson);
    const texts = [
      ...lesson.checks.flatMap((q) => [
        q.question,
        q.explanation,
        ...q.options,
      ]),
      ...exercises.flatMap((e) =>
        e.kind === 'predict'
          ? [e.question, e.explanation, ...e.options]
          : e.hints,
      ),
    ];
    for (const text of texts) {
      expect(shownText(text), `${row.id}: ${text}`).not.toContain('`');
    }
  });

  it('links only to lessons that exist', () => {
    const analysis = analysisOf(lessonOf(row.id));
    for (const link of analysis.lessonLinks) {
      expect(
        registry.lesson(link.id),
        `<Lesson id="${link.id}" />`,
      ).toBeDefined();
    }
  });
});
