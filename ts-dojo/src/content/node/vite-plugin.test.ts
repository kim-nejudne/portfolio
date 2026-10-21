// The exercise prompt as a build-time module (§1 "prompt (Markdown)", §2 "No content is fetched
// at runtime"): `exercise.yaml?prompt` resolves to a virtual `…/exercise.yaml.prompt.md` id that
// the MDX compiler takes as plain Markdown, whose source is the YAML's `prompt` field. And the
// §7 `contentVersion` as a virtual module (its hash is tested in content-version.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  schemaFor,
  yamlModule,
  CONTENT_VERSION_ID,
  contentVersionModule,
  CONTENT_ROOT_ID,
  contentRootModule,
  resolveContentAlias,
  PROMPT_QUERY,
  isPromptId,
  promptId,
  promptSource,
} from './vite-plugin';
import {
  contentDirFor,
  COURSE_CONTENT,
  FIXTURE_CONTENT,
  outDirFor,
} from './roots';

describe('the prompt module', () => {
  it('names a virtual .md id next to the exercise.yaml, and recognises it', () => {
    const yaml = '/repo/content/modules/m/l/exercises/01-x/exercise.yaml';
    expect(PROMPT_QUERY).toBe('?prompt');
    expect(promptId(yaml)).toBe(`${yaml}.prompt.md`);
    expect(isPromptId(promptId(yaml))).toBe(true);
    expect(isPromptId(yaml)).toBe(false);
    expect(isPromptId('/repo/content/modules/m/l/lesson.mdx')).toBe(false);
  });

  it('is the prompt field of an editor exercise, and empty for a predict exercise', () => {
    expect(
      promptSource(
        'id: m/l/01-x\nkind: implement\ntitle: T\nminutes: 3\nprompt: |\n  Write `area`:\n\n  - a list item\n',
      ),
    ).toBe('Write `area`:\n\n- a list item\n');
    expect(
      promptSource(
        'id: m/l/02-y\nkind: predict\ntitle: T\nminutes: 1\nquestion: Q\noptions: [a, b]\nanswer: 0\nexplanation: E\n',
      ),
    ).toBe('');
    expect(promptSource('not: [valid')).toBe('');
  });
});

describe('the content version module (§7 contentVersion)', () => {
  it('is a virtual id whose module exports the hash as its default', () => {
    expect(CONTENT_VERSION_ID).toBe('virtual:ts-dojo/content-version');
    expect(contentVersionModule('ab12')).toBe('export default "ab12";\n');
  });
});

describe('the content tree the build reads (F11: content/ or fixtures/content/)', () => {
  it('resolves the registry globs under the tree, and nothing else', () => {
    expect(
      resolveContentAlias('@content/**/*.yaml', '/repo/fixtures/content'),
    ).toBe('/repo/fixtures/content/**/*.yaml');
    expect(
      resolveContentAlias('@content/modules/*/*/lesson.mdx', '/repo/content'),
    ).toBe('/repo/content/modules/*/*/lesson.mdx');
    expect(resolveContentAlias('@/content/registry', '/repo/content')).toBe(
      null,
    );
    expect(resolveContentAlias('/content/x.yaml', '/repo/content')).toBe(null);
  });

  it('tells the registry which tree its keys come from', () => {
    expect(CONTENT_ROOT_ID).toBe('virtual:ts-dojo/content-root');
    expect(contentRootModule('fixtures/content')).toBe(
      'export default "fixtures/content";\n',
    );
  });

  it('follows the Vite mode: e2e builds the fixtures into dist-e2e/, every other mode the course into dist/', () => {
    expect(contentDirFor('e2e')).toBe('fixtures/content');
    expect(outDirFor('e2e')).toBe('dist-e2e');
    expect(contentDirFor('production')).toBe('content');
    expect(outDirFor('production')).toBe('dist');
    expect(contentDirFor('development')).toBe('content');
  });
});

describe('the YAML modules', () => {
  // The browser registry parses each module's JSON with the same schema again
  // (src/content/registry.ts → buildRegistry), so a schema's output must be its own valid input.
  it('give, for every YAML file of the course and the fixtures, JSON its schema parses back unchanged', () => {
    const files = [COURSE_CONTENT, FIXTURE_CONTENT].flatMap((content) =>
      readdirSync(content, { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('.yaml'))
        .map((file) => path.join(content, file)),
    );
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const code = yamlModule(readFileSync(file, 'utf8'), file, file);
      const json: unknown = JSON.parse(
        code.replace(/^export default /, '').replace(/;\n$/, ''),
      );
      expect(schemaFor(file)?.parse(json), file).toEqual(json);
    }
  });
});
