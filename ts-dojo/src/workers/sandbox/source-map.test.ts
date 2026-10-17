// The inline map decoder against real `ts.transpileModule` output: a generated position maps
// back to its TypeScript line and column, which is what the console `loc` and the runtime
// error position rest on (§4 Running, §12 F4).
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  decodeMappings,
  originalPosition,
  parseInlineSourceMap,
} from './source-map';

function transpile(text: string, fileName = '/index.ts'): string {
  return ts.transpileModule(text, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2025,
      module: ts.ModuleKind.ESNext,
      inlineSourceMap: true,
      inlineSources: true,
    },
  }).outputText;
}

describe('source maps', () => {
  it('decodes VLQ mappings into per-line segments', () => {
    // 'AAAA' → column 0, source 0, line 0, column 0; 'CAAC' → +1, +0, +0, +1; every field but
    // the generated column carries across lines, so 'AACA' on line 3 keeps column 1.
    expect(decodeMappings('AAAA,CAAC;;AACA')).toEqual([
      [
        { generatedColumn: 0, source: 0, line: 0, column: 0 },
        { generatedColumn: 1, source: 0, line: 0, column: 1 },
      ],
      [],
      [{ generatedColumn: 0, source: 0, line: 1, column: 1 }],
    ]);
  });

  it('finds the inline map and maps a generated line back to the TypeScript line', () => {
    const js = transpile(
      [
        'import { area, type Shape } from "./shapes";',
        'type Local = Shape;',
        'const x: number = area({ kind: "circle", radius: 1 });',
        '',
        'console.log(x);',
        'throw new Error("boom");',
      ].join('\n'),
    );
    const map = parseInlineSourceMap(js);
    expect(map).not.toBeNull();
    expect(map?.sources).toEqual(['index.ts']);
    const generated = js.split('\n');
    const logLine = generated.findIndex((l) => l.startsWith('console.log')) + 1;
    const throwLine = generated.findIndex((l) => l.startsWith('throw')) + 1;
    expect(logLine).toBeGreaterThan(0);
    // `type Local` is erased, so the generated lines sit above their TS lines.
    expect(originalPosition(map!, logLine, 1)).toEqual({
      source: 'index.ts',
      line: 5,
      column: 1,
    });
    expect(originalPosition(map!, throwLine, 7)).toEqual({
      source: 'index.ts',
      line: 6,
      column: 7,
    });
  });

  it('returns null for a line without mappings and for text without a map', () => {
    const map = parseInlineSourceMap(transpile('const a = 1;\n'));
    expect(map).not.toBeNull();
    expect(originalPosition(map!, 99, 1)).toBeNull();
    expect(parseInlineSourceMap('const a = 1;')).toBeNull();
  });
});
