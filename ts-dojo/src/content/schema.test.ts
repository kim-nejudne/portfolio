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

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MODULE = path.join(ROOT, 'content', 'modules', 'm99-fixtures');

function yaml(file: string): unknown {
  return parse(readFileSync(file, 'utf8')) as unknown;
}

describe('roadmap.yaml', () => {
  it('accepts the shipped roadmap', () => {
    const parsed = roadmapSchema.parse(
      yaml(path.join(ROOT, 'content', 'roadmap.yaml')),
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
    expect(parsed.timeoutMs).toBe(5000);
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

  it('accepts the shipped renames file and refuses a one-segment target', () => {
    expect(
      renamesSchema.parse(yaml(path.join(ROOT, 'content', 'renames.yaml')))
        .renames,
    ).toEqual([]);
    expect(
      renamesSchema.safeParse({
        renames: [{ from: 'm01-a/01-b', to: 'm01-a' }],
      }).success,
    ).toBe(false);
  });
});
