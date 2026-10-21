// The registry over the fixture content tree (§12 F6 criterion 5: the three fixture lessons
// exist and load, under fixtures/content/ since F11; F9 added two predict-only fixture modules
// for the roadmap)
// and the structural checks that feed §3 conditions 1, 4, 5 and 7 (the content lint's own
// tests mutate a copy of the tree; these pin the builder directly).
import { describe, expect, it } from 'vitest';
import {
  buildRegistry,
  exerciseFiles,
  findCycle,
  isEditorExercise,
  type ContentInput,
} from './build-registry';
import { loadContent, loadContentInput } from './node/load';
import { FIXTURE_CONTENT } from './node/roots';

const CONTENT = FIXTURE_CONTENT;

describe('the shipped content tree', () => {
  it('has two tiers and three modules in roadmap order, every lesson and exercise in order, with no problems', async () => {
    const { registry, problems } = await loadContent(CONTENT);
    expect(problems).toEqual([]);
    expect(registry.tiers.map((t) => [t.id, t.modules])).toEqual([
      ['t9', ['m99-fixtures', 'm98-fixture-sequel']],
      ['t10', ['m97-fixture-capstone']],
    ]);
    expect(registry.modules.map((m) => [m.id, m.prerequisites])).toEqual([
      ['m99-fixtures', []],
      ['m98-fixture-sequel', ['m99-fixtures']],
      ['m97-fixture-capstone', ['m99-fixtures', 'm98-fixture-sequel']],
    ]);
    expect(registry.lessons.map((l) => l.id)).toEqual([
      'm99-fixtures/01-fix',
      'm99-fixtures/02-implement',
      'm99-fixtures/03-type-challenge',
      'm98-fixture-sequel/01-literal-widening',
      'm98-fixture-sequel/02-tuples',
      'm98-fixture-sequel/03-readonly-arrays',
      'm97-fixture-capstone/01-keyof',
      'm97-fixture-capstone/02-typeof',
      'm97-fixture-capstone/03-indexed-access',
    ]);
    expect(registry.exercises.map((e) => e.kind)).toEqual([
      'fix',
      'predict',
      'implement',
      'fix',
      'type-challenge',
      'implement',
      // m98 and m97 (F9): predict-only, the cheapest lessons the §3 lint accepts.
      ...Array<string>(12).fill('predict'),
    ]);
    expect(registry.module('m99-fixtures')?.lessons).toHaveLength(3);
    expect(registry.lesson('m99-fixtures/01-fix')?.exercises).toEqual([
      'm99-fixtures/01-fix/01-handle-the-new-shape',
      'm99-fixtures/01-fix/02-what-is-left',
    ]);
    expect(registry.renames).toEqual([
      { from: 'm99-fixtures/00-first-fix', to: 'm99-fixtures/01-fix' },
      {
        from: 'm99-fixtures/02-implement/00-biggest-shape',
        to: 'm99-fixtures/02-implement/01-largest-shape',
      },
    ]);
  });

  it('carries the exercise files, the tests text and the lesson questions', async () => {
    const { registry } = await loadContent(CONTENT);
    const fix = registry.exercise(
      'm99-fixtures/01-fix/01-handle-the-new-shape',
    );
    if (fix === undefined || !isEditorExercise(fix))
      throw new Error('fixture missing');
    expect(fix.starter.map((f) => f.path)).toEqual(['/index.ts']);
    expect(fix.solution[0]?.text).toContain("case 'triangle':");
    expect(fix.starter[0]?.text).not.toContain("case 'triangle':");
    expect(fix.testsText).toContain("import { area } from './index'");
    expect(exerciseFiles(fix, 'solution').map((f) => f.path)).toEqual([
      '/index.ts',
      '/tests.ts',
    ]);
    expect(fix.dts).toEqual([]);
    const lesson = registry.lesson('m99-fixtures/01-fix');
    expect(lesson?.checks.map((c) => c.id)).toEqual(['default-branch-type']);
    expect(lesson?.checks[0]?.options).toHaveLength(4);
    expect(lesson?.objectives).toHaveLength(2);
  });

  it('every id is unique across tiers, modules, lessons and exercises', async () => {
    const { registry } = await loadContent(CONTENT);
    const ids = [
      ...registry.tiers.map((t) => t.id),
      ...registry.modules.map((m) => m.id),
      ...registry.lessons.map((l) => l.id),
      ...registry.exercises.map((e) => e.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

async function mutated(
  change: (input: ContentInput) => void,
): Promise<ReturnType<typeof buildRegistry>['problems']> {
  const { input } = await loadContentInput(CONTENT);
  change(input);
  return buildRegistry(input).problems;
}

const MODULE_YAML = 'content/modules/m99-fixtures/module.yaml';
const LESSON_1 = 'content/modules/m99-fixtures/01-fix/lesson.mdx';
const EXERCISE_1 =
  'content/modules/m99-fixtures/01-fix/exercises/01-handle-the-new-shape/exercise.yaml';

function yamlOf(input: ContentInput, key: string): Record<string, unknown> {
  return input.yaml[key] as Record<string, unknown>;
}

describe('structural problems carry their §3 condition', () => {
  it('1: a schema error names the path and the field', async () => {
    const problems = await mutated((input) => {
      yamlOf(input, EXERCISE_1)['kind'] = 'quiz';
    });
    expect(problems).toContainEqual(
      expect.objectContaining({ condition: 1, path: EXERCISE_1 }),
    );
  });

  it('1: a duplicate id, a missing prerequisite and a cycle', async () => {
    expect(
      await mutated((input) => {
        (
          input.lessons[LESSON_1] as { frontmatter: Record<string, unknown> }
        ).frontmatter['id'] = 'm99-fixtures/02-implement';
      }),
    ).toContainEqual(
      expect.objectContaining({
        condition: 1,
        message: expect.stringContaining('duplicate id') as string,
      }),
    );
    expect(
      await mutated((input) => {
        yamlOf(input, MODULE_YAML)['prerequisites'] = ['m42-missing'];
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 1, path: MODULE_YAML }),
    );
    expect(
      await mutated((input) => {
        yamlOf(input, MODULE_YAML)['prerequisites'] = ['m99-fixtures'];
      }),
    ).toContainEqual(
      expect.objectContaining({
        condition: 1,
        message: expect.stringContaining('cycle') as string,
      }),
    );
  });

  it('4: too few exercises, too few lessons, no hints, too many hints', async () => {
    expect(
      await mutated((input) => {
        delete input.yaml[
          'content/modules/m99-fixtures/01-fix/exercises/02-what-is-left/exercise.yaml'
        ];
      }),
    ).toContainEqual(expect.objectContaining({ condition: 4, path: LESSON_1 }));
    expect(
      await mutated((input) => {
        yamlOf(input, MODULE_YAML)['lessons'] = ['01-fix', '02-implement'];
        delete input.lessons[
          'content/modules/m99-fixtures/03-type-challenge/lesson.mdx'
        ];
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 4, path: MODULE_YAML }),
    );
    expect(
      await mutated((input) => {
        yamlOf(input, EXERCISE_1)['hints'] = [];
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 4, path: EXERCISE_1 }),
    );
    expect(
      await mutated((input) => {
        yamlOf(input, EXERCISE_1)['hints'] = ['a', 'b', 'c', 'd'];
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 4, path: EXERCISE_1 }),
    );
  });

  it('5: a question with one option, with no correct option, with a duplicate or missing id', async () => {
    const predict =
      'content/modules/m99-fixtures/01-fix/exercises/02-what-is-left/exercise.yaml';
    expect(
      await mutated((input) => {
        yamlOf(input, predict)['options'] = ['only'];
      }),
    ).toContainEqual(expect.objectContaining({ condition: 5, path: predict }));
    expect(
      await mutated((input) => {
        yamlOf(input, predict)['answer'] = 9;
      }),
    ).toContainEqual(expect.objectContaining({ condition: 5, path: predict }));
    expect(
      await mutated((input) => {
        const lesson = input.lessons[LESSON_1] as { predicts: unknown[] };
        lesson.predicts = [lesson.predicts[0], lesson.predicts[0]];
      }),
    ).toContainEqual(expect.objectContaining({ condition: 5, path: LESSON_1 }));
    expect(
      await mutated((input) => {
        const lesson = input.lessons[LESSON_1] as {
          predicts: Record<string, unknown>[];
        };
        const rest: Record<string, unknown> = { ...lesson.predicts[0] };
        delete rest['id'];
        lesson.predicts = [rest];
      }),
    ).toContainEqual(expect.objectContaining({ condition: 5, path: LESSON_1 }));
  });

  it('7: an id that does not match its folder, and a rename target that does not exist', async () => {
    expect(
      await mutated((input) => {
        yamlOf(input, EXERCISE_1)['id'] = 'm99-fixtures/01-fix/01-renamed';
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 7, path: EXERCISE_1 }),
    );
    expect(
      await mutated((input) => {
        input.yaml['content/renames.yaml'] = {
          'm99-fixtures/00-old': 'm99-fixtures/09-nowhere',
        };
      }),
    ).toContainEqual(
      expect.objectContaining({ condition: 7, path: 'content/renames.yaml' }),
    );
    // An exercise rename is checked against the exercises, not the lessons.
    expect(
      await mutated((input) => {
        input.yaml['content/renames.yaml'] = {
          'm99-fixtures/01-fix/00-old': 'm99-fixtures/01-fix/09-nowhere',
        };
      }),
    ).toContainEqual(
      expect.objectContaining({
        condition: 7,
        message: 'rename target m99-fixtures/01-fix/09-nowhere does not exist',
      }),
    );
    expect(
      await mutated((input) => {
        input.yaml['content/renames.yaml'] = {
          'm99-fixtures/01-fix/00-old': 'm99-fixtures/01-fix/02-what-is-left',
        };
      }),
    ).not.toContainEqual(expect.objectContaining({ condition: 7 }));
  });
});

describe('findCycle', () => {
  it('returns the cycle path or null', () => {
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['c']],
          ['c', []],
        ]),
      ),
    ).toBeNull();
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['a']],
        ]),
      ),
    ).toEqual(['a', 'b', 'a']);
    expect(findCycle(new Map([['a', ['zz']]]))).toBeNull();
  });
});
