// §12 F11 criterion 1: "M00 to M04 exist as §8 lists them: 20 lessons, each with the §1
// structure, at least two exercises (one in M00), at least one `predict`, hints on every editor
// exercise, and at least one `ts twoslash` block." §12 F12: "M05 to M09, 19 core lessons and the
// two optional ones, to the same rules as F11". §12 F13: "M10 to M14, 18 core lessons and three
// optional, with the type-challenges sets crediting their source". §12 F14: "M15 to M18, 17
// core lessons and one optional; Zod and React's types pre-bundled for 17.2 and 17.4", so 80
// lessons in all. Read from the course in content/ with the
// loader the content lint and the build use. The §8 rows below are copied from docs/spec.md
// (titles with their code backticks dropped; minutes as §8 gives them). What no test can judge
// (accuracy, progression, hints that nudge) is the content-reviewer agent's.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  isEditorExercise,
  type Exercise,
  type Lesson,
  type Registry,
} from '../build-registry';
import { hasRuntimeTests } from '@/verify/exercise';
import { shownText } from '../inline-code';
import type { LessonAnalysis } from './analyze';
import { loadContent, type LoadedContent } from './load';
import { createRenderer, type Renderer } from './mdx';
import { COURSE_CONTENT, REPO_ROOT } from './roots';

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
          // (opt) in §8: `optional: true` (Kim, 23 October 2026).
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
          // (opt) in §8: `optional: true` (Kim, 23 October 2026).
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
  {
    id: 't3',
    title: 'Advanced type system',
    modules: [
      {
        id: 'm10-mapped-types',
        title: 'Mapped types',
        prerequisites: ['m09-modules-async'],
        lessons: [
          [
            '01-mapped-types-and-modifiers',
            'Mapped types, homomorphism, and the +/- modifiers for readonly and ?',
            25,
          ],
          [
            '02-key-remapping',
            'Key remapping with as and template literals',
            20,
          ],
          [
            '03-mapping-unions-tuples-arrays',
            'Mapping over unions, tuples and arrays',
            20,
          ],
        ],
      },
      {
        id: 'm11-conditional-types',
        title: 'Conditional types',
        prerequisites: ['m10-mapped-types'],
        lessons: [
          ['01-conditional-types', 'Conditional types and assignability', 20],
          ['02-infer', 'infer', 20],
          [
            '03-distributive-conditionals',
            'Distributive conditional types, and how to stop distribution',
            20,
          ],
          [
            '04-recursive-conditionals',
            'Recursive conditional types and the patterns: Flatten, DeepPartial, DeepReadonly, UnionToIntersection',
            30,
          ],
        ],
      },
      {
        id: 'm12-template-tuples',
        title: 'Template-literal and tuple types',
        prerequisites: ['m11-conditional-types'],
        lessons: [
          [
            '01-template-literal-types',
            'Template literal types, the intrinsics, and parsing strings with infer',
            30,
          ],
          ['02-variadic-tuples', 'Variadic tuple types', 20],
          [
            '03-tuple-manipulation',
            'Tuple manipulation: Head, Tail, Last, Length, Reverse, Includes',
            25,
          ],
          [
            '04-recursion-limits',
            'Recursion limits, tail recursion and accumulators',
            20,
          ],
        ],
      },
      {
        id: 'm13-type-challenges',
        title: 'Type-level programming track',
        prerequisites: ['m12-template-tuples'],
        lessons: [
          // §8's "(13 challenges)" is a note, not title text.
          ['01-easy-set', 'type-challenges, easy set', 45],
          ['02-medium-set-1', 'Medium set I', 60],
          ['03-medium-set-2', 'Medium set II', 60],
          // (opt) in §8: `optional: true`.
          ['04-hard-set', 'Hard set, selected', 60],
          ['05-extreme-set', 'Extreme set, selected', 60],
        ],
      },
      {
        id: 'm14-type-system-edges',
        title: 'The edges of the type system',
        prerequisites: ['m11-conditional-types'],
        lessons: [
          [
            '01-assignability-variance',
            'Assignability, variance, and in/out annotations',
            25,
          ],
          [
            '02-const-type-params-noinfer',
            'const type parameters and NoInfer',
            20,
          ],
          [
            '03-branded-types',
            'Branded, nominal and phantom types; unique symbol',
            20,
          ],
          [
            '04-declaration-merging',
            'Declaration merging, namespaces, module and global augmentation',
            20,
          ],
          // (opt) in §8: `optional: true`.
          ['05-decorators', 'Decorators: the TS 5 standard decorators', 20],
        ],
      },
    ],
  },
  {
    id: 't4',
    title: 'Expert',
    modules: [
      {
        id: 'm15-api-design',
        title: 'Type-safe API design',
        prerequisites: ['m13-type-challenges', 'm14-type-system-edges'],
        lessons: [
          ['01-builders', 'Builders and fluent chains', 25],
          ['02-typed-events', 'Typed event emitters and pub/sub', 25],
          [
            '03-pipe-compose',
            'pipe, compose and inference-driven signatures',
            30,
          ],
          ['04-typed-routes', 'Typed routes and path parameters', 25],
        ],
      },
      {
        id: 'm16-tooling',
        title: 'Tooling and configuration',
        prerequisites: ['m09-modules-async'],
        lessons: [
          [
            '01-strict-flags',
            'tsconfig: the strict family, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature, and what each catches',
            25,
          ],
          [
            '02-module-resolution',
            'Module resolution: bundler, node16/nodenext, paths, .js extensions in imports',
            20,
          ],
          [
            '03-project-references',
            "Project references, isolatedDeclarations, erasableSyntaxOnly and Node's type stripping",
            20,
          ],
          [
            '04-typescript-6-and-7',
            'TypeScript 6 and 7: the new defaults, the deprecations, the native compiler',
            15,
          ],
          [
            '05-authoring-declarations',
            'Authoring .d.ts for a JavaScript library',
            25,
          ],
        ],
      },
      {
        id: 'm17-boundaries',
        title: 'Types at the boundary',
        prerequisites: ['m09-modules-async', 'm11-conditional-types'],
        lessons: [
          ['01-parse-dont-validate', "Parse, don't validate", 20],
          [
            '02-zod-and-valibot',
            'Zod and Valibot: schema inference, transforms, branded output',
            25,
          ],
          [
            '03-fetch-json-env',
            'Typing fetch, JSON and environment variables',
            20,
          ],
          [
            '04-react',
            'TypeScript with React: props, generic components, discriminated props, hooks',
            30,
          ],
        ],
      },
      {
        id: 'm18-capstones',
        title: 'Capstones',
        prerequisites: ['m15-api-design', 'm16-tooling', 'm17-boundaries'],
        lessons: [
          ['01-type-safe-router', 'A type-safe router', 45],
          ['02-query-builder', 'A query builder', 45],
          ['03-typed-store', 'A typed state store with typed actions', 45],
          // (opt) in §8: `optional: true`.
          ['04-json-parser', 'A type-level JSON parser', 60],
          [
            '05-type-performance',
            'Type performance clinic: deep instantiation, --generateTrace, measuring',
            30,
          ],
        ],
      },
    ],
  },
];

/** The type-challenges track (§8 M13): one exercise per challenge (Deviations, F13). */
const TRACK = 'm13-type-challenges';

/** type-challenges' LICENSE (MIT), fetched from the repository on 23 October 2026. */
const TYPE_CHALLENGES_COPYRIGHT =
  'Copyright (c) 2020 Anthony Fu <https://github.com/antfu>';
const TYPE_CHALLENGES_REPO =
  'https://github.com/type-challenges/type-challenges';
/** The whole notice, line by line, as each M13 lesson's Further reading carries it in a `text` fence. */
const MIT_NOTICE = [
  'MIT License',
  '',
  TYPE_CHALLENGES_COPYRIGHT,
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy',
  'of this software and associated documentation files (the "Software"), to deal',
  'in the Software without restriction, including without limitation the rights',
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  'copies of the Software, and to permit persons to whom the Software is',
  'furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all',
  'copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
  'SOFTWARE.',
].join('\n');

/**
 * The challenges each M13 lesson sets, as type-challenges' question folders, in exercise order
 * (the F13 plan Kim approved on 23 October 2026: all of easy, ten medium twice, seven hard, five
 * extreme).
 */
const CHALLENGES: Record<string, string[]> = {
  [`${TRACK}/01-easy-set`]: [
    '00004-easy-pick',
    '00007-easy-readonly',
    '00011-easy-tuple-to-object',
    '00014-easy-first',
    '00018-easy-tuple-length',
    '00043-easy-exclude',
    '00189-easy-awaited',
    '00268-easy-if',
    '00533-easy-concat',
    '00898-easy-includes',
    '03057-easy-push',
    '03060-easy-unshift',
    '03312-easy-parameters',
  ],
  [`${TRACK}/02-medium-set-1`]: [
    '00002-medium-return-type',
    '00003-medium-omit',
    '00008-medium-readonly-2',
    '00009-medium-deep-readonly',
    '00010-medium-tuple-to-union',
    '00012-medium-chainable-options',
    '00015-medium-last',
    '00016-medium-pop',
    '00020-medium-promise-all',
    '00062-medium-type-lookup',
  ],
  [`${TRACK}/03-medium-set-2`]: [
    '00106-medium-trimleft',
    '00108-medium-trim',
    '00110-medium-capitalize',
    '00116-medium-replace',
    '00119-medium-replaceall',
    '00298-medium-length-of-string',
    '00459-medium-flatten',
    '01042-medium-isnever',
    '00296-medium-permutation',
    '01097-medium-isunion',
  ],
  [`${TRACK}/04-hard-set`]: [
    '00017-hard-currying-1',
    '00057-hard-get-required',
    '00089-hard-required-keys',
    '00114-hard-camelcase',
    '00223-hard-isany',
    '00270-hard-typed-get',
    '00300-hard-string-to-number',
  ],
  [`${TRACK}/05-extreme-set`]: [
    '00005-extreme-readonly-keys',
    '00216-extreme-slice',
    '00274-extreme-integers-comparator',
    '00476-extreme-sum',
    '00151-extreme-query-string-parser',
  ],
};

/** A challenge's page, as a prompt links it. */
function challengeUrl(folder: string): string {
  return `${TYPE_CHALLENGES_REPO}/blob/main/questions/${folder}/README.md`;
}

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

describe('§12 F11 to F14: the course in content/ is Tiers 0 to 4 as §8 lists them', () => {
  it('loads with no structural problem', () => {
    expect(content.problems).toEqual([]);
  });

  it("the roadmap has §8's tiers t0 to t4, in order", () => {
    expect(registry.tiers).toEqual(
      TIERS.map((tier) => ({
        id: tier.id,
        title: tier.title,
        modules: tier.modules.map((m) => m.id),
      })),
    );
  });

  it("80 lessons in all: F11's 20, F12's 19 core and two optional, F13's 18 core and three optional, F14's 17 core and one optional", () => {
    expect(LESSONS).toHaveLength(80);
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

  it('the lessons §8 marks (opt), 5.5, 8.4, 13.4, 13.5, 14.5 and 18.4, are exactly the optional ones', () => {
    expect(registry.lessons.filter((l) => l.optional).map((l) => l.id)).toEqual(
      [
        'm05-generics/05-when-generics-hurt',
        'm08-functions-classes/04-mixins',
        'm13-type-challenges/04-hard-set',
        'm13-type-challenges/05-extreme-set',
        'm14-type-system-edges/05-decorators',
        'm18-capstones/04-json-parser',
      ],
    );
  });

  it.each(LESSONS)('$id matches its §8 row: title and minutes', (row) => {
    expect(lessonOf(row.id)).toMatchObject({
      title: row.title,
      minutes: row.minutes,
    });
  });
});

describe.each(LESSONS)('§12 F11 to F14: $id', (row) => {
  it('has the §1 structure: the five theory sections in order, 2–5 objectives, runnable examples, two or three pitfalls each with a snippet, 1–3 questions, further reading', () => {
    const lesson = lessonOf(row.id);
    const analysis = analysisOf(lesson);
    expect(
      analysis.headings.filter((h) => h.depth === 2).map((h) => h.text),
    ).toEqual(SECTIONS);
    expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
    expect(lesson.objectives.length).toBeLessThanOrEqual(5);
    expect(
      inSection(analysis, analysis.fences, 'Concept').length,
      'Concept has the smallest example (§1)',
    ).toBeGreaterThan(0);
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

  it('has at least two exercises (one in M00) and at most five (M13: one per challenge), at least one predict, and 1–3 hints on every editor exercise', () => {
    const exercises = exercisesOf(lessonOf(row.id));
    const least = row.module === 'm00-orientation' ? 1 : 2;
    expect(exercises.length).toBeGreaterThanOrEqual(least);
    if (row.module === TRACK) {
      // Deviations (F13): one type-challenge per challenge the set selects, plus predicts.
      const set = CHALLENGES[row.id] ?? [];
      expect(exercises.filter((e) => e.kind === 'type-challenge')).toHaveLength(
        set.length,
      );
    } else {
      expect(exercises.length).toBeLessThanOrEqual(5);
    }
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

describe('§12 F13: the type-challenges sets credit their source', () => {
  const track = LESSONS.filter((row) => row.module === TRACK);

  it.each(track)(
    '$id sets its challenges in order, each prompt naming and linking its challenge (MIT)',
    (row) => {
      const challenges = exercisesOf(lessonOf(row.id))
        .filter(isEditorExercise)
        .filter((e) => e.kind === 'type-challenge');
      const set = CHALLENGES[row.id] ?? [];
      expect(challenges.map((e) => e.id)).toHaveLength(set.length);
      challenges.forEach((exercise, index) => {
        const folder = set[index] ?? '';
        const number = folder.slice(0, 5);
        expect(exercise.prompt, exercise.id).toContain(challengeUrl(folder));
        expect(exercise.prompt, exercise.id).toContain(
          `From type-challenges [#${number} `,
        );
        expect(exercise.prompt, exercise.id).toContain('(MIT)');
      });
    },
  );

  it.each(track)(
    "$id: every tests.ts opens with its challenge's link and type-challenges' copyright line",
    (row) => {
      const challenges = exercisesOf(lessonOf(row.id))
        .filter(isEditorExercise)
        .filter((e) => e.kind === 'type-challenge');
      const set = CHALLENGES[row.id] ?? [];
      challenges.forEach((exercise, index) => {
        const header = (exercise.testsText ?? '').split('\n').slice(0, 2);
        expect(header[0], exercise.id).toBe(
          `// Cases adapted from type-challenges #${(set[index] ?? '').slice(0, 5)}, ${challengeUrl(set[index] ?? '')}`,
        );
        expect(header[1], exercise.id).toBe(
          `// MIT License, ${TYPE_CHALLENGES_COPYRIGHT}`,
        );
      });
    },
  );

  it.each(track)(
    "$id: Further reading links the repository and carries type-challenges' MIT notice",
    (row) => {
      const lesson = lessonOf(row.id);
      const analysis = analysisOf(lesson);
      expect(
        inSection(analysis, analysis.links, 'Further reading').map(
          (l) => l.url,
        ),
      ).toContain(TYPE_CHALLENGES_REPO);
      const source = readFileSync(path.join(REPO_ROOT, lesson.path), 'utf8');
      const reading = source.slice(source.indexOf('\n## Further reading'));
      expect(reading, `${row.id}: the MIT notice, verbatim`).toContain(
        '```text\n' + MIT_NOTICE + '\n```',
      );
    },
  );
});

describe("§12 F14: Zod and React's types pre-bundled for 17.2 and 17.4", () => {
  const ZOD_LESSON = 'm17-boundaries/02-zod-and-valibot';
  const REACT_LESSON = 'm17-boundaries/04-react';
  const imports = (text: string, specifier: string): boolean =>
    new RegExp(`from\\s+['"]${specifier}['"]`).test(text);

  it('17.2 runs Zod: a ts run example imports zod, and an exercise with runtime tests parses with it', () => {
    const lesson = lessonOf(ZOD_LESSON);
    const fences = analysisOf(lesson).fences;
    expect(fences.some((f) => f.kind === 'run' && imports(f.code, 'zod'))).toBe(
      true,
    );
    const zodExercises = exercisesOf(lesson)
      .filter(isEditorExercise)
      .filter((e) => e.solution.some((f) => imports(f.text, 'zod')));
    expect(
      zodExercises.some((e) => hasRuntimeTests(e)),
      'an exercise whose solution imports zod has runtime tests',
    ).toBe(true);
  });

  it('17.2 compares Valibot in a twoslash block only (build time; Zod is the one pre-bundled)', () => {
    const lesson = lessonOf(ZOD_LESSON);
    const fences = analysisOf(lesson).fences;
    expect(
      fences.some((f) => f.kind === 'twoslash' && imports(f.code, 'valibot')),
    ).toBe(true);
    expect(
      fences.some((f) => f.kind !== 'twoslash' && imports(f.code, 'valibot')),
    ).toBe(false);
    for (const exercise of exercisesOf(lesson).filter(isEditorExercise)) {
      expect(
        [...exercise.starter, ...exercise.solution].some((f) =>
          imports(f.text, 'valibot'),
        ),
        exercise.id,
      ).toBe(false);
    }
  });

  it("17.4 checks React's types: .tsx exercises under jsx: react-jsx that import react, verified by types alone", () => {
    const lesson = lessonOf(REACT_LESSON);
    const editor = exercisesOf(lesson).filter(isEditorExercise);
    expect(editor.length).toBeGreaterThan(0);
    for (const exercise of editor) {
      expect(exercise.entry, exercise.id).toMatch(/\.tsx$/);
      expect(exercise.compilerOptions['jsx'], exercise.id).toBe('react-jsx');
      // React has types only in the dojo: no exercise needs a run (Deviations, F14).
      expect(hasRuntimeTests(exercise), exercise.id).toBe(false);
    }
    expect(
      editor.some((e) => e.solution.some((f) => imports(f.text, 'react'))),
    ).toBe(true);
    expect(
      analysisOf(lesson).fences.some(
        (f) => f.kind === 'twoslash' && f.code.includes('@jsx: react-jsx'),
      ),
    ).toBe(true);
  });
});
