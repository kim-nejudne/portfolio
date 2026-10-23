// The §3 Zod schemas over the shipped fixture files and over the shapes they must refuse (§12
// F6 criterion 5: the fixture lessons exist and load; criterion 1: a schema error is a lint
// failure, so the schemas must actually refuse bad input).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  exerciseSchema,
  formatZodError,
  lessonFrontmatterSchema,
  moduleSchema,
  predictPropsSchema,
  renamesSchema,
  roadmapSchema,
} from './schema';
import { FIXTURE_CONTENT } from './node/roots';

const MODULE = path.join(FIXTURE_CONTENT, 'modules', 'm99-fixtures');

function yaml(file: string): unknown {
  return parse(readFileSync(file, 'utf8')) as unknown;
}

describe('roadmap.yaml', () => {
  it('accepts the fixture roadmap', () => {
    const parsed = roadmapSchema.parse(
      yaml(path.join(FIXTURE_CONTENT, 'roadmap.yaml')),
    );
    expect(parsed.tiers[0]?.modules).toContain('m99-fixtures');
  });

  it('refuses a tier without modules', () => {
    const result = roadmapSchema.safeParse({
      tiers: [{ id: 't1', title: 'x' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('module.yaml', () => {
  it('accepts the fixture module and defaults prerequisites', () => {
    const parsed = moduleSchema.parse(yaml(path.join(MODULE, 'module.yaml')));
    expect(parsed.lessons).toEqual([
      '01-fix',
      '02-implement',
      '03-type-challenge',
    ]);
    expect(
      moduleSchema.parse({ id: 'm01-x', title: 't', summary: 's', lessons: [] })
        .prerequisites,
    ).toEqual([]);
  });

  it('refuses an id that is not a slug', () => {
    expect(
      moduleSchema.safeParse({
        id: 'M01 Types',
        title: 't',
        summary: 's',
        lessons: [],
      }).success,
    ).toBe(false);
  });
});

describe('lesson frontmatter', () => {
  it('needs two to five objectives and a two-segment id', () => {
    const base = { id: 'm99-fixtures/01-fix', title: 't', minutes: 5 };
    expect(
      lessonFrontmatterSchema.safeParse({ ...base, objectives: ['a'] }).success,
    ).toBe(false);
    expect(
      lessonFrontmatterSchema.safeParse({ ...base, objectives: ['a', 'b'] })
        .success,
    ).toBe(true);
    expect(
      lessonFrontmatterSchema.safeParse({
        ...base,
        id: '01-fix',
        objectives: ['a', 'b'],
      }).success,
    ).toBe(false);
  });

  it('optional (pre-F13) defaults to false, takes true, and refuses anything else', () => {
    const base = {
      id: 'm99-fixtures/01-fix',
      title: 't',
      minutes: 5,
      objectives: ['a', 'b'],
    };
    expect(lessonFrontmatterSchema.parse(base).optional).toBe(false);
    expect(
      lessonFrontmatterSchema.parse({ ...base, optional: true }).optional,
    ).toBe(true);
    expect(
      lessonFrontmatterSchema.safeParse({ ...base, optional: 'yes' }).success,
    ).toBe(false);
  });
});

describe('exercise.yaml', () => {
  const editor = yaml(
    path.join(
      MODULE,
      '01-fix',
      'exercises',
      '01-handle-the-new-shape',
      'exercise.yaml',
    ),
  );
  const predict = yaml(
    path.join(
      MODULE,
      '01-fix',
      'exercises',
      '02-what-is-left',
      'exercise.yaml',
    ),
  );

  it('accepts the fix and predict fixtures', () => {
    const fix = exerciseSchema.parse(editor);
    expect(fix.kind).toBe('fix');
    if (fix.kind !== 'predict') {
      expect(fix.forbid).toEqual([
        'explicit-any',
        'non-null-assertion',
        'as-unknown-as',
      ]);
      expect(fix.entry).toBe('index.ts');
      expect(fix.timeoutMs).toBe(5000);
    }
    const p = exerciseSchema.parse(predict);
    expect(p.kind).toBe('predict');
    if (p.kind === 'predict') expect(p.options).toHaveLength(4);
  });

  it('refuses a wrong kind, an unknown rule id and a missing answer', () => {
    expect(
      exerciseSchema.safeParse({ ...(editor as object), kind: 'quiz' }).success,
    ).toBe(false);
    expect(
      exerciseSchema.safeParse({ ...(editor as object), forbid: ['no-any'] })
        .success,
    ).toBe(false);
    // The two opt-in rules of the pre-F13 fixes are rule ids like the rest.
    expect(
      exerciseSchema.safeParse({
        ...(editor as object),
        forbid: ['type-assertion', 'any-expression'],
      }).success,
    ).toBe(true);
    const noAnswer: Record<string, unknown> = {
      ...(predict as Record<string, unknown>),
    };
    delete noAnswer['answer'];
    expect(exerciseSchema.safeParse(noAnswer).success).toBe(false);
  });

  it('fills the defaults of an editor exercise', () => {
    const parsed = exerciseSchema.parse({
      id: 'm01-a/01-b/01-c',
      kind: 'implement',
      title: 't',
      minutes: 3,
      prompt: 'p',
      tests: 'tests.ts',
      hints: ['h'],
    });
    if (parsed.kind === 'predict') throw new Error('unexpected kind');
    expect(parsed.challenge).toBe(false);
    expect(parsed.entry).toBe('index.ts');
    expect(parsed.compilerOptions).toEqual({});
    expect(parsed.libs).toEqual([]);
    expect(parsed.forbid).toEqual([]);
    // F10: an omitted timeoutMs stays omitted, so the run follows the Settings default.
    expect(parsed.timeoutMs).toBeUndefined();
  });
});

describe('<Predict> props and renames.yaml', () => {
  it('needs an id, a question, options, an answer index and an explanation', () => {
    expect(
      predictPropsSchema.safeParse({
        id: 'q',
        question: '?',
        options: ['a', 'b'],
        answer: 0,
        explanation: 'e',
      }).success,
    ).toBe(true);
    const result = predictPropsSchema.safeParse({
      question: '?',
      options: ['a', 'b'],
      answer: 0,
      explanation: 'e',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatZodError(result.error)).toMatch(/^id: /);
  });

  it('reads the shipped renames file as `old: new` pairs (§7)', () => {
    expect(
      renamesSchema.parse(yaml(path.join(FIXTURE_CONTENT, 'renames.yaml'))),
    ).toEqual({
      'm99-fixtures/00-first-fix': 'm99-fixtures/01-fix',
      'm99-fixtures/02-implement/00-biggest-shape':
        'm99-fixtures/02-implement/01-largest-shape',
    });
  });

  it('accepts lesson and exercise ids, an empty file, and refuses a module id or a list', () => {
    const both = {
      'm01-a/01-b': 'm01-a/02-c',
      'm01-a/01-b/01-x': 'm01-a/01-b/02-y',
    };
    expect(renamesSchema.parse(both)).toEqual(both);
    // The output parses again unchanged: the plugin's JSON module goes through the schema twice.
    expect(renamesSchema.parse(renamesSchema.parse(both))).toEqual(both);
    expect(renamesSchema.parse(null)).toEqual({});
    expect(
      renamesSchema.safeParse({ 'm01-a/01-b': 'm01-a/01-b/01-x' }).success,
    ).toBe(false);
    expect(renamesSchema.safeParse({ 'm01-a/01-b': 'm01-a' }).success).toBe(
      false,
    );
    expect(renamesSchema.safeParse({ 'm01-a': 'm01-a/01-b' }).success).toBe(
      false,
    );
    expect(
      renamesSchema.safeParse({
        renames: [{ from: 'm01-a/01-b', to: 'm01-a/02-c' }],
      }).success,
    ).toBe(false);
  });
});
