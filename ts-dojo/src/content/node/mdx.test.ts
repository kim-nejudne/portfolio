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
  styleClass,
  FenceRenderError,
  lessonMdxOptions,
  SNIPPET_PATH,
  type Renderer,
} from './mdx';
import { FIXTURE_CONTENT } from './roots';

const LESSON = path.join(
  FIXTURE_CONTENT,
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
    expect(block.js).toBeUndefined();
  });

  // Pre-F13 fixes (Kim, 23 October 2026, the §9 precache): shiki's inline
  // `style="--shiki-light:…;--shiki-dark:…"` became a class per colour pair, with the pairs
  // returned beside the block for the lesson's one stylesheet.
  it('writes each colour pair as a class, not an inline style, and returns the classes with their pairs', async () => {
    const block = await renderer.render('twoslash', TWOSLASH, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.html).not.toMatch(/style="[^"]*--shiki/);
    const used = new Set(
      [...block.html.matchAll(/\bsk-[0-9a-z]+\b/g)].map((m) => m[0]),
    );
    expect(used.size).toBeGreaterThan(2);
    expect(new Set(Object.keys(block.styles))).toEqual(used);
    for (const style of Object.values(block.styles)) {
      expect(style).toMatch(
        /^--shiki-light:#[0-9a-f]+;--shiki-dark:#[0-9a-f]+/i,
      );
    }
    // The block's own colours (its background too) are a class on the <pre>.
    expect(block.html).toMatch(/^<pre class="shiki [^"]*\bsk-[0-9a-z]+/);
  });

  it('names a colour pair the same in every block and every build', async () => {
    const one = await renderer.render('static', 'const a = 1;', {
      path: 'a.mdx',
      line: 1,
    });
    const two = await renderer.render('run', 'const b = 2;\nconsole.log(b);', {
      path: 'b.mdx',
      line: 1,
    });
    const keyword = (html: string) =>
      /<span class="(sk-[0-9a-z]+)">const<\/span>/.exec(html)?.[1];
    expect(keyword(one.html)).toBeDefined();
    expect(keyword(one.html)).toBe(keyword(two.html));
    expect(styleClass('--shiki-light:#D73A49;--shiki-dark:#F97583')).toBe(
      keyword(one.html),
    );
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
      styles: expect.any(Object) as Record<string, string>,
    });
  });

  // After F13 (Kim, 23 October 2026): every other fence (`text`, `vim`, `js`) gets the code-block
  // look too, highlighted in its own language when shiki has one, else as plain text.
  it('a plain block is highlighted in its own language, with colour classes', async () => {
    const block = await renderer.render(
      'plain',
      'const a = 1;',
      { path: 'x.mdx', line: 1 },
      'js',
    );
    expect(block).toEqual({
      kind: 'plain',
      code: 'const a = 1;',
      html: expect.stringContaining('class="shiki') as string,
      styles: expect.any(Object) as Record<string, string>,
    });
    expect(block.html).toMatch(/class="sk-[0-9a-z]+"[^>]*>const</);
    expect(block.html).not.toContain('--shiki');
  });

  it('a plain block in a language shiki lacks, or none, is plain text, escaped', async () => {
    for (const lang of ['text', 'no-such-language', undefined]) {
      const block = await renderer.render(
        'plain',
        '<b>MIT</b> & "Software"',
        { path: 'x.mdx', line: 1 },
        lang,
      );
      expect(block.kind, String(lang)).toBe('plain');
      expect(block.html, String(lang)).toContain('class="shiki');
      expect(block.html, String(lang)).toContain('&#x3C;b>MIT&#x3C;/b>');
      expect(block.html, String(lang)).not.toContain('<b>');
    }
  });
});

describe('the pre-bundled packages in theory (§12 F14)', () => {
  it('a twoslash block imports zod and valibot and shows the inferred type', async () => {
    const code = [
      "import { z } from 'zod';",
      "import * as v from 'valibot';",
      'const Z = z.object({ id: z.number() });',
      'const V = v.object({ id: v.number() });',
      'type FromZod = z.infer<typeof Z>;',
      '//   ^?',
      'type FromValibot = v.InferOutput<typeof V>;',
      '//   ^?',
      '',
    ].join('\n');
    const block = await renderer.render('twoslash', code, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.html).toContain('type FromZod = {');
    expect(block.html).toContain('type FromValibot = {');
  });

  it('a twoslash .tsx block under react-jsx resolves React and reports a wrong prop', async () => {
    const code = [
      '// @jsx: react-jsx',
      '// @errors: 2322',
      '// @filename: badge.tsx',
      "import type { ReactNode } from 'react';",
      'function Badge(props: { label: string; children?: ReactNode }) {',
      '  return <span>{props.label}{props.children}</span>;',
      '}',
      'const ok = <Badge label="new" />;',
      '//    ^?',
      'const wrong = <Badge label={1} />;',
      '',
    ].join('\n');
    const block = await renderer.render('twoslash', code, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.html).toContain('JSX.Element');
    expect(block.html).toContain('2322');
  });

  it('a twoslash block can add the DOM lib with // @lib (F14, 17.3)', async () => {
    const code = [
      '// @lib: es2025,dom',
      "const res = await fetch('/api');",
      '//    ^?',
      'export {};',
      '',
    ].join('\n');
    const block = await renderer.render('twoslash', code, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.html).toContain('const res: Response');
  });

  it("a block's package.json never leaks into a later block (F14, 16.2)", async () => {
    const esm = [
      '// @module: nodenext',
      '// @moduleResolution: nodenext',
      '// @resolveJsonModule: true',
      '// @errors: 2835',
      '// @filename: package.json',
      '{ "type": "module" }',
      '// @filename: lib.ts',
      'export const n = 1;',
      '// @filename: index.ts',
      "import { n } from './lib';",
      'console.log(n);',
      '',
    ].join('\n');
    await renderer.render('twoslash', esm, { path: 'x.mdx', line: 1 });
    // The same files without a package.json are CommonJS: the import needs no extension.
    const cjs = [
      '// @module: nodenext',
      '// @moduleResolution: nodenext',
      '// @filename: lib.ts',
      'export const n = 1;',
      '// @filename: index.ts',
      "import { n } from './lib';",
      'console.log(n);',
      '',
    ].join('\n');
    const block = await renderer.render('twoslash', cjs, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.html).not.toContain('2835');
  });

  it('a run block importing zod has no diagnostics and keeps the import for the sandbox', async () => {
    const code =
      "import { z } from 'zod';\nconsole.log(z.string().parse('ok'));\n";
    expect(await renderer.check(code)).toEqual([]);
    const block = await renderer.render('run', code, {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.js).toContain("from 'zod'");
    // The block's imports travel with its JavaScript, so Run can hand the sandbox their spans
    // and `zod` is rewritten to the pre-bundled module (the F14 e2e found it was not).
    const js = block.js ?? '';
    const start = js.indexOf("'zod'") + 1;
    expect(block.imports).toEqual([
      { specifier: 'zod', start, end: start + 3 },
    ]);
    const element = codeBlockElement(block);
    expect(
      element.attributes.find(
        (a) => a.type === 'mdxJsxAttribute' && a.name === 'imports',
      )?.value,
    ).toBe(JSON.stringify(block.imports));
  });

  it('a run block with no import carries no imports prop', async () => {
    const block = await renderer.render('run', 'console.log(1);\n', {
      path: 'x.mdx',
      line: 1,
    });
    expect(block.imports).toBeUndefined();
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
  it('has every fence as a CodeBlock, the twoslash results inline, and imports only the JSX runtime', async () => {
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
    // After F13: the fixture's `text` fence is a CodeBlock too, not MDX's bare <pre>.
    expect(out).toContain('kind: "plain"');
    expect(out).toContain('2322');
    // One stylesheet for the lesson's colour classes, and no inline colour styles.
    expect(out.match(/CodeStyles/g)?.length).toBeGreaterThanOrEqual(1);
    expect(out).toMatch(/css: "[^"]*\.sk-[0-9a-z]+\{--shiki-light:/);
    expect(out).not.toMatch(/style=\\"--shiki/);
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
