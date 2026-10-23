// §12 F6 criterion 1: `pnpm content:lint` fails on each §3 condition, one fixture per
// condition. Each fixture is the shipped content tree copied to a temp directory with one
// mutation, so every fixture is a whole valid tree minus the one thing the condition names.
// Criterion 2: the shipped tree passes, every solution passing and every starter failing, in
// Node with the app's own core and sandbox modules. The structural conditions (1, 4, 5, 7) stop
// the lint before any compiler work; 2, 3 and 6 run the real verification.
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  formatExerciseLine,
  lintContent,
  type LintCondition,
  type LintFailure,
  type LintReport,
} from '../src/content/node/lint';
import { COURSE_CONTENT, FIXTURE_CONTENT } from '../src/content/node/roots';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = FIXTURE_CONTENT;
const MODULE = 'modules/m99-fixtures';
const FIX_EXERCISE = `${MODULE}/01-fix/exercises/01-handle-the-new-shape`;
const PREDICT_EXERCISE = `${MODULE}/01-fix/exercises/02-what-is-left/exercise.yaml`;
const IMPLEMENT_EXERCISE = `${MODULE}/02-implement/exercises/01-largest-shape`;
const TYPE_EXERCISE = `${MODULE}/03-type-challenge/exercises/01-describe-the-events`;
const LESSON_1 = `${MODULE}/01-fix/lesson.mdx`;

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

interface Tree {
  root: string;
  edit(file: string, change: (text: string) => string): void;
  write(file: string, text: string): void;
  remove(file: string): void;
}

/** A copy of the fixture tree in a temp dir, with helpers to mutate one file. */
function copyTree(): Tree {
  const root = mkdtempSync(path.join(tmpdir(), 'ts-dojo-content-'));
  temps.push(root);
  cpSync(CONTENT, root, { recursive: true });
  const at = (file: string) => path.join(root, file);
  return {
    root,
    edit: (file, change) =>
      writeFileSync(at(file), change(readFileSync(at(file), 'utf8'))),
    write: (file, text) => writeFileSync(at(file), text),
    remove: (file) => rmSync(at(file), { recursive: true, force: true }),
  };
}

function conditions(report: LintReport): LintCondition[] {
  return [...new Set(report.failures.map((f) => f.condition))].sort();
}

function expectFailure(
  report: LintReport,
  condition: LintCondition,
  path: string | RegExp,
  message?: string | RegExp,
): LintFailure {
  const hit = report.failures.find(
    (f) =>
      f.condition === condition &&
      (typeof path === 'string' ? f.path === path : path.test(f.path)) &&
      (message === undefined ||
        (typeof message === 'string'
          ? f.message.includes(message)
          : message.test(f.message))),
  );
  expect(
    hit,
    `no §3 condition ${String(condition)} failure at ${String(path)} in ${JSON.stringify(report.failures, null, 1)}`,
  ).toBeDefined();
  return hit as LintFailure;
}

/** Only this exercise's folder is verified, so the compiler-backed fixtures stay quick. */
const FIX_ONLY = { only: ['m99-fixtures/01-fix'] };

describe('the shipped course in content/ (§12 F11 criterion 2, F12)', () => {
  it('lints clean: `pnpm content:lint` passes for the whole tree', async () => {
    const report = await lintContent(COURSE_CONTENT);
    expect(report.failures).toEqual([]);
    expect(report.lessons).toHaveLength(41);
    for (const exercise of report.exercises) {
      expect(exercise.failures, exercise.id).toEqual([]);
    }
  }, 180_000);
});

describe('the fixture content tree (§12 F6 criterion 2)', () => {
  it('passes the lint: every solution passes its exercise and every starter fails it, in Node', async () => {
    const report = await lintContent(CONTENT);
    expect(report.failures).toEqual([]);
    // The three m99 lessons plus F9's six predict-only fixture lessons (m98, m97).
    expect(report.lessons).toHaveLength(9);
    expect(report.exercises.map((e) => e.id)).toEqual([
      'm99-fixtures/01-fix/01-handle-the-new-shape',
      'm99-fixtures/02-implement/01-largest-shape',
      'm99-fixtures/02-implement/02-literal-discriminant',
      'm99-fixtures/03-type-challenge/01-describe-the-events',
      'm99-fixtures/03-type-challenge/02-area-by-kind',
    ]);
    for (const exercise of report.exercises) {
      expect(exercise.solution.passed, `${exercise.id} solution`).toBe(true);
      expect(exercise.starter.passed, `${exercise.id} starter`).toBe(false);
      if (exercise.kind === 'fix') {
        expect(exercise.starter.compiles.ok, `${exercise.id} fix starter`).toBe(
          false,
        );
      }
      expect(formatExerciseLine(exercise)).toMatch(
        /^ok {2}.*solution passes \(compiles types runtime rules\); starter fails (compiles|types|runtime)$/,
      );
    }
  }, 60_000);

  it('narrows to the ids it is given', async () => {
    const report = await lintContent(CONTENT, {
      only: ['m99-fixtures/03-type-challenge'],
    });
    expect(report.lessons).toEqual(['m99-fixtures/03-type-challenge']);
    expect(report.exercises.map((e) => e.kind)).toEqual([
      'type-challenge',
      'implement',
    ]);
  }, 60_000);
});

describe('§3 condition 1: schema, duplicate id, prerequisite, cycle', () => {
  it('a schema error names the file and the field', async () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/exercise.yaml`, (t) =>
      t.replace('kind: fix', 'kind: quiz'),
    );
    const report = await lintContent(tree.root);
    expectFailure(report, 1, `content/${FIX_EXERCISE}/exercise.yaml`, 'kind');
    expect(report.exercises).toEqual([]);
  });

  it('a duplicate id', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) =>
      t.replace('id: m99-fixtures/01-fix', 'id: m99-fixtures/02-implement'),
    );
    const report = await lintContent(tree.root);
    expectFailure(report, 1, /lesson\.mdx$/, 'duplicate id');
  });

  it('a prerequisite that does not exist', async () => {
    const tree = copyTree();
    tree.edit(`${MODULE}/module.yaml`, (t) =>
      t.replace('prerequisites: []', 'prerequisites: [m42-nowhere]'),
    );
    const report = await lintContent(tree.root);
    expectFailure(
      report,
      1,
      `content/${MODULE}/module.yaml`,
      'm42-nowhere does not exist',
    );
  });

  it('a cycle in prerequisites', async () => {
    const tree = copyTree();
    tree.edit(`${MODULE}/02-implement/lesson.mdx`, (t) =>
      t.replace(
        'prerequisites: [m99-fixtures/01-fix]',
        'prerequisites: [m99-fixtures/03-type-challenge]',
      ),
    );
    tree.edit(`${MODULE}/03-type-challenge/lesson.mdx`, (t) =>
      t.replace(
        'prerequisites: [m99-fixtures/01-fix]',
        'prerequisites: [m99-fixtures/02-implement]',
      ),
    );
    const report = await lintContent(tree.root);
    expectFailure(report, 1, /lesson\.mdx$/, 'cycle');
  });
});

describe('§3 condition 2: a solution that does not pass its own exercise', () => {
  it('a diagnostic', async () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/solution/index.ts`, (t) =>
      t.replace("case 'triangle':", "case 'hexagon':"),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expectFailure(
      report,
      2,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      /solution does not pass: index\.ts:\d+ TS/,
    );
    expect(conditions(report)).toEqual([2]);
  }, 60_000);

  it('a failing type case', async () => {
    const tree = copyTree();
    tree.edit(
      `${TYPE_EXERCISE}/solution/index.ts`,
      (t) =>
        `${t.trimEnd().slice(0, -1)}\n  | { type: 'hover'; x: number; y: number };\n`,
    );
    const report = await lintContent(tree.root, {
      only: [`m99-fixtures/03-type-challenge/01-describe-the-events`],
    });
    expectFailure(
      report,
      2,
      `content/${TYPE_EXERCISE}/exercise.yaml`,
      /type cases failed: exactly the three members, case 4/,
    );
  }, 60_000);

  it('a failing runtime test', async () => {
    const tree = copyTree();
    tree.edit(`${IMPLEMENT_EXERCISE}/solution/index.ts`, (t) =>
      t.replace(
        'return shape.width * shape.height;',
        'return shape.width + shape.height;',
      ),
    );
    const report = await lintContent(tree.root, {
      only: ['m99-fixtures/02-implement/01-largest-shape'],
    });
    expectFailure(
      report,
      2,
      `content/${IMPLEMENT_EXERCISE}/exercise.yaml`,
      'runtime test "area of a rect" fail',
    );
  }, 60_000);

  it('a forbidden construct', async () => {
    const tree = copyTree();
    tree.edit(
      `${FIX_EXERCISE}/solution/index.ts`,
      (t) => `${t}\nexport const leak: any = 1;\n`,
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expectFailure(
      report,
      2,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      'explicit-any at index.ts',
    );
  }, 60_000);
});

describe('§3 condition 3: a starter that already passes', () => {
  it('a starter equal to the solution', async () => {
    const tree = copyTree();
    tree.write(
      `${FIX_EXERCISE}/starter/index.ts`,
      readFileSync(
        path.join(CONTENT, FIX_EXERCISE, 'solution', 'index.ts'),
        'utf8',
      ),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expectFailure(
      report,
      3,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      'starter already passes',
    );
  }, 60_000);

  it('a fix starter with no diagnostics (even when its tests fail)', async () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/starter/index.ts`, (t) =>
      t.replace(
        "case 'square':\n      return shape.side ** 2;",
        "case 'square':\n      return shape.side ** 2;\n    case 'triangle':\n      return 0;",
      ),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expectFailure(
      report,
      3,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      'fix starter has no diagnostics',
    );
    expect(report.exercises[0]?.starter.passed).toBe(false);
  }, 60_000);
});

describe('§3 condition 4: counts', () => {
  it('a lesson with fewer than two exercises', async () => {
    const tree = copyTree();
    tree.remove(`${MODULE}/01-fix/exercises/02-what-is-left`);
    expectFailure(
      await lintContent(tree.root),
      4,
      `content/${LESSON_1}`,
      'at least 2',
    );
  });

  it('a module with fewer than three lessons', async () => {
    const tree = copyTree();
    tree.remove(`${MODULE}/03-type-challenge`);
    tree.edit(`${MODULE}/module.yaml`, (t) =>
      t.replace('  - 03-type-challenge\n', ''),
    );
    expectFailure(
      await lintContent(tree.root),
      4,
      `content/${MODULE}/module.yaml`,
      'at least 3',
    );
  });

  it('a non-predict exercise without hints', async () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/exercise.yaml`, (t) =>
      t.replace(/hints:[\s\S]*$/, 'hints: []\n'),
    );
    expectFailure(
      await lintContent(tree.root),
      4,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      'without hints',
    );
  });

  it('more than three hints', async () => {
    const tree = copyTree();
    tree.edit(
      `${FIX_EXERCISE}/exercise.yaml`,
      (t) => `${t}  - four\n  - five\n`,
    );
    expectFailure(
      await lintContent(tree.root),
      4,
      `content/${FIX_EXERCISE}/exercise.yaml`,
      'at most 3',
    );
  });
});

describe('§3 condition 5: predict questions', () => {
  it('a predict exercise with no correct option (answer out of range)', async () => {
    const tree = copyTree();
    tree.edit(PREDICT_EXERCISE, (t) => t.replace('answer: 1', 'answer: 7'));
    expectFailure(
      await lintContent(tree.root),
      5,
      `content/${PREDICT_EXERCISE}`,
      'none is correct',
    );
  });

  it('a predict exercise with fewer than two options', async () => {
    const tree = copyTree();
    tree.edit(PREDICT_EXERCISE, (t) =>
      t
        .replace(/options:[\s\S]*?answer:/, 'options:\n  - "Shape"\nanswer:')
        .replace('answer: 1', 'answer: 0'),
    );
    expectFailure(
      await lintContent(tree.root),
      5,
      `content/${PREDICT_EXERCISE}`,
      'at least 2',
    );
  });

  it('an inline <Predict> with a duplicate id', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) => {
      const start = t.indexOf('<Predict');
      const end = t.indexOf('/>', start) + 2;
      const block = t.slice(start, end);
      return `${t.slice(0, end)}\n\n${block}${t.slice(end)}`;
    });
    expectFailure(
      await lintContent(tree.root),
      5,
      `content/${LESSON_1}`,
      'appears twice',
    );
  });

  it('an inline <Predict> with a missing id', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) => t.replace('  id="default-branch-type"\n', ''));
    expectFailure(await lintContent(tree.root), 5, `content/${LESSON_1}`, 'id');
  });

  it('an inline <Predict> whose props are not literals cannot be checked', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) =>
      t.replace(
        "options={['Shape', 'never', 'unknown', 'undefined']}",
        'options={someOptions}',
      ),
    );
    expectFailure(
      await lintContent(tree.root),
      1,
      `content/${LESSON_1}`,
      'not a literal',
    );
  });
});

describe('§3 condition 6: fences', () => {
  it('a ts run block with a diagnostic', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) =>
      t.replace(
        "console.log(describe({ kind: 'circle', radius: 2 }));",
        "console.log(describe({ kind: 'oval', radius: 2 }));",
      ),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    const failure = expectFailure(
      report,
      6,
      /01-fix\/lesson\.mdx:\d+$/,
      'ts run block has a diagnostic: TS2322',
    );
    // The line points into the lesson file, below the fence's opening line.
    expect(Number(failure.path.split(':')[1])).toBeGreaterThan(30);
  }, 60_000);

  it('a ts twoslash block that fails to render', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) =>
      t.replace(
        'type Shape = Circle | Square;\n\nfunction area',
        'type Shape = Circle | Square;\nconst bad: number = "x";\n\nfunction area',
      ),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expectFailure(
      report,
      6,
      /01-fix\/lesson\.mdx:\d+$/,
      'ts twoslash block failed to render',
    );
  }, 60_000);
});

describe('§3 condition 7: ids and renames', () => {
  it('a lesson id that does not match its folder', async () => {
    const tree = copyTree();
    tree.edit(LESSON_1, (t) =>
      t.replace('id: m99-fixtures/01-fix', 'id: m99-fixtures/01-repair'),
    );
    expectFailure(
      await lintContent(tree.root),
      7,
      `content/${LESSON_1}`,
      'does not match its folder',
    );
  });

  it('a renames.yaml target that does not exist', async () => {
    const tree = copyTree();
    tree.write(
      'renames.yaml',
      'm99-fixtures/00-old: m99-fixtures/09-nowhere\n',
    );
    expectFailure(
      await lintContent(tree.root),
      7,
      'content/renames.yaml',
      'm99-fixtures/09-nowhere does not exist',
    );
  });
});

describe('the CLI', () => {
  it('exits 1 and prints the failure with its condition for a broken tree, 0 for a good one', () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/exercise.yaml`, (t) =>
      t.replace(/hints:[\s\S]*$/, 'hints: []\n'),
    );
    const broken = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/content-lint.ts', `--root=${tree.root}`],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain('content lint: 1 failure');
    expect(broken.stderr).toContain(
      'editor exercise without hints (§3 condition 4)',
    );
    const good = spawnSync(
      'pnpm',
      [
        'exec',
        'tsx',
        'scripts/content-lint.ts',
        `--root=${CONTENT}`,
        'm99-fixtures/01-fix',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(good.status, good.stderr).toBe(0);
    expect(good.stdout).toContain('content lint: ok');
    expect(good.stdout).toMatch(
      /^ok {3}m99-fixtures\/01-fix\/01-handle-the-new-shape \[fix\]/m,
    );
  }, 60_000);
});

describe('the lint stops at structural problems', () => {
  it('reports them without verifying any exercise', async () => {
    const tree = copyTree();
    tree.edit(`${FIX_EXERCISE}/exercise.yaml`, (t) =>
      t.replace(/hints:[\s\S]*$/, 'hints: []\n'),
    );
    tree.edit(`${FIX_EXERCISE}/solution/index.ts`, (t) =>
      t.replace("case 'triangle':", "case 'hexagon':"),
    );
    const report = await lintContent(tree.root);
    expect(conditions(report)).toEqual([4]);
    expect(report.exercises).toEqual([]);
    expect(report.lessons).toEqual([]);
  });
});

describe('a scoped run while a module is still being written (F11)', () => {
  // A module.yaml lists every lesson from the start (module skill), so a module in progress
  // names lessons that don't exist yet: a structural problem of the module, not of the lessons
  // already written. A run narrowed to a written lesson verifies it; the module's own run and
  // the whole-tree run still refuse the tree.
  function moduleInProgress(): Tree {
    const tree = copyTree();
    tree.edit(
      `${MODULE}/module.yaml`,
      (t) => `${t.trimEnd()}\n  - 04-not-yet\n`,
    );
    return tree;
  }

  it('verifies the exercises of a written lesson', async () => {
    const report = await lintContent(moduleInProgress().root, FIX_ONLY);
    expect(report.failures).toEqual([]);
    expect(report.lessons).toEqual(['m99-fixtures/01-fix']);
    expect(report.exercises.map((e) => e.id)).toEqual([
      'm99-fixtures/01-fix/01-handle-the-new-shape',
    ]);
  }, 60_000);

  it('still stops a run of the module, and of the whole tree, at condition 1', async () => {
    const tree = moduleInProgress();
    for (const options of [{ only: ['m99-fixtures'] }, {}]) {
      const report = await lintContent(tree.root, options);
      expectFailure(
        report,
        1,
        `content/${MODULE}/module.yaml`,
        'lesson 04-not-yet has no',
      );
      expect(report.exercises).toEqual([]);
    }
  });

  it('still stops a scoped run at a structural problem inside the lesson', async () => {
    const tree = moduleInProgress();
    tree.edit(`${FIX_EXERCISE}/exercise.yaml`, (t) =>
      t.replace(/hints:[\s\S]*$/, 'hints: []\n'),
    );
    const report = await lintContent(tree.root, FIX_ONLY);
    expect(conditions(report)).toEqual([4]);
    expect(report.exercises).toEqual([]);
  });
});
