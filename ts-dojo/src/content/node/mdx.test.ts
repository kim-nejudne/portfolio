// The fence pipeline in Node (§12 F6 criterion 3: `^?` results rendered at build time;
// criterion 4: run blocks carry their JavaScript, run-errors blocks their diagnostics): the
// renderer's output per kind, the remark plugin over a compiled lesson, and the §3 condition 6
// failure for a twoslash block that does not render.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  codeBlockElement,
  createRenderer,
  FenceRenderError,
  lessonMdxOptions,
  SNIPPET_PATH,
  type Renderer,
} from './mdx';

const LESSON = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'content',
  'modules',
  'm99-fixtures',
  '01-fix',
  'lesson.mdx',
);

let renderer: Renderer;
const getRenderer = () => Promise.resolve(renderer);

beforeAll(async () => {
  renderer = await createRenderer();
}, 60_000);

afterAll(() => {
  renderer.dispose();
});

const TWOSLASH = `type Circle = { kind: 'circle'; radius: number };
const c: Circle = { kind: 'circle', radius: 1 };
c.kind;
//  ^?
console.log(c);
`;

describe('the renderer', () => {
  it('renders a twoslash block with the queried type in the HTML and the ^? line removed', async () => {
    const block = await renderer.render('twoslash', TWOSLASH, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.kind).toBe('twoslash');
    expect(block.html).toContain('class="shiki');
    expect(block.html).toContain("'circle'");
    expect(block.html).toContain('twoslash');
    expect(block.html).not.toContain('^?');
    expect(block.html).toContain('--shiki-dark');
    expect(block.js).toBeUndefined();
  });

  it('refuses a twoslash block with a type error, naming the file and line', async () => {
    await expect(
      renderer.render('twoslash', 'const n: number = "x";\n', {
        path: 'l.mdx',
        line: 12,
      }),
    ).rejects.toThrow(FenceRenderError);
    await expect(
      renderer.render('twoslash', 'const n: number = "x";\n', {
        path: 'l.mdx',
        line: 12,
      }),
    ).rejects.toThrow(/^l\.mdx:12: ts twoslash block failed to render/);
  });

  it('a run block carries its emitted JavaScript with a source map and no diagnostics', async () => {
    const block = await renderer.render(
      'run',
      'const n: number = 1;\nconsole.log(n * 2);\n',
      {
        path: 'x.mdx',
        line: 1,
      },
    );
    expect(block.kind).toBe('run');
    expect(block.js).toContain('console.log(n * 2)');
    expect(block.js).toContain('sourceMappingURL=data:');
    expect(block.js).not.toContain(': number');
    expect(block.diagnostics).toBeUndefined();
  });

  it('a run-errors block carries the diagnostics the app core reports', async () => {
    const block = await renderer.render(
      'run-errors',
      'const n: number = "x";\n',
      {
        path: 'x.mdx',
        line: 1,
      },
    );
    expect(block.kind).toBe('run-errors');
    expect(block.diagnostics).toEqual([
      expect.objectContaining({ file: SNIPPET_PATH, line: 1, code: 2322 }),
    ]);
    expect(block.js).toContain('const n = "x"');
  });

  it("check() reports a snippet's diagnostics; console is declared", async () => {
    expect(await renderer.check('console.log(1);\n')).toEqual([]);
    expect(
      (await renderer.check('let s: string = 1;\n')).map((d) => d.code),
    ).toEqual([2322]);
  });

  it('a static block is highlighted only', async () => {
    const block = await renderer.render('static', 'let x = 1;', {
      path: 'x.mdx',
      line: 1,
    });
    expect(block).toEqual({
      kind: 'static',
      code: 'let x = 1;',
      html: expect.stringContaining('shiki') as string,
    });
  });
});

describe('concurrent renders', () => {
  it('give every block its own JavaScript and diagnostics (the build compiles lessons in parallel)', async () => {
    const snippets = [
      'console.log("one");\n',
      'console.log("two");\n',
      'const n: number = "three";\n',
    ];
    const [one, two, three] = await Promise.all([
      renderer.render('run', snippets[0] as string, { path: 'a.mdx', line: 1 }),
      renderer.render('run', snippets[1] as string, { path: 'b.mdx', line: 1 }),
      renderer.render('run-errors', snippets[2] as string, {
        path: 'c.mdx',
        line: 1,
      }),
    ]);
    expect(one.js).toContain('"one"');
    expect(two.js).toContain('"two"');
    expect(three.js).toContain('"three"');
    expect(three.diagnostics?.map((d) => d.code)).toEqual([2322]);
    const checks = await Promise.all(
      snippets.map((code) => renderer.check(code)),
    );
    expect(checks.map((d) => d.length)).toEqual([0, 0, 1]);
  });
});

describe('codeBlockElement', () => {
  it('writes the props as string attributes, diagnostics as JSON', () => {
    const element = codeBlockElement({
      kind: 'run-errors',
      code: 'c',
      html: '<pre/>',
      js: 'j',
      diagnostics: [],
    });
    expect(element).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'CodeBlock',
    });
    expect(
      element.attributes.map((a) =>
        a.type === 'mdxJsxAttribute' ? [a.name, a.value] : a,
      ),
    ).toEqual([
      ['kind', 'run-errors'],
      ['code', 'c'],
      ['html', '<pre/>'],
      ['js', 'j'],
      ['diagnostics', '[]'],
    ]);
  });
});

describe('a compiled lesson', () => {
  it('has every ts fence as a CodeBlock, the twoslash results inline, and imports only the JSX runtime', async () => {
    const source = readFileSync(LESSON, 'utf8');
    const out = String(
      await compile(
        { value: source, path: LESSON },
        lessonMdxOptions(getRenderer),
      ),
    );
    expect(out).toContain('CodeBlock');
    expect(out).not.toContain('<pre>');
    // The `code` prop keeps the source (Open in REPL needs it); the rendered html does not.
    expect(out).not.toMatch(/html: "[^"]*\^\?/);
    // The narrowed types the ^? queries ask for, pre-rendered.
    expect(out).toContain('Circle');
    expect(out).toContain('Square');
    expect(out).toContain('kind: "run"');
    expect(out).toContain('kind: "run-errors"');
    expect(out).toContain('kind: "twoslash"');
    expect(out).toContain('2322');
    const imports = [...out.matchAll(/^import .* from "([^"]+)";?$/gm)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(['react/jsx-runtime']);
  }, 60_000);

  it('fails the compile when a twoslash block has a type error', async () => {
    const source = `---\nid: x\n---\n\n\`\`\`ts twoslash\nconst n: number = 'x';\n\`\`\`\n`;
    await expect(
      compile(
        { value: source, path: 'bad/lesson.mdx' },
        lessonMdxOptions(getRenderer),
      ),
    ).rejects.toThrow(/bad\/lesson\.mdx:5: ts twoslash block failed to render/);
  });
});
