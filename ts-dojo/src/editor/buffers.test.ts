// `:b <file>`, `:ls`, `:bnext`, `:bprev` (§4 Multi-file exercises; §12 F3 "Multi-file: tabs,
// :b, :ls, gt, gT"): the pure resolution the editor component switches tabs with.
import { describe, expect, it } from 'vitest';
import {
  basename,
  cycleBuffer,
  listBuffers,
  resolveBuffer,
} from './buffers.ts';

const PATHS = ['/index.ts', '/shapes.ts', '/shapes.d.ts'];

describe('resolveBuffer (:b <file>)', () => {
  it('matches a path, a basename, or a unique prefix of either', () => {
    expect(resolveBuffer('/index.ts', PATHS)).toBe('/index.ts');
    expect(resolveBuffer('index.ts', PATHS)).toBe('/index.ts');
    expect(resolveBuffer('ind', PATHS)).toBe('/index.ts');
    expect(resolveBuffer('shapes.d', PATHS)).toBe('/shapes.d.ts');
    expect(resolveBuffer(' shapes.ts ', PATHS)).toBe('/shapes.ts');
  });

  it('returns null for nothing, an unknown name, or an ambiguous prefix', () => {
    expect(resolveBuffer('', PATHS)).toBeNull();
    expect(resolveBuffer('tests.ts', PATHS)).toBeNull();
    expect(resolveBuffer('shapes', PATHS)).toBeNull();
    expect(resolveBuffer('sh', PATHS)).toBeNull();
  });

  it('basename strips the directory', () => {
    expect(basename('/dir/file.ts')).toBe('file.ts');
    expect(basename('file.ts')).toBe('file.ts');
  });
});

describe('cycleBuffer (:bnext, :bprev, gt, gT)', () => {
  it('moves forward and backward and wraps at both ends', () => {
    expect(cycleBuffer('/index.ts', PATHS, 1)).toBe('/shapes.ts');
    expect(cycleBuffer('/shapes.d.ts', PATHS, 1)).toBe('/index.ts');
    expect(cycleBuffer('/index.ts', PATHS, -1)).toBe('/shapes.d.ts');
    expect(cycleBuffer('/shapes.ts', PATHS, -1)).toBe('/index.ts');
    expect(cycleBuffer('/index.ts', [], 1)).toBeNull();
  });
});

describe('listBuffers (:ls)', () => {
  it('numbers every file, marks the current one %a and read-only files [RO]', () => {
    expect(listBuffers(PATHS, '/shapes.ts', new Set(['/shapes.d.ts']))).toBe(
      [
        ' 1    "index.ts"',
        ' 2 %a "shapes.ts"',
        ' 3    "shapes.d.ts" [RO]',
      ].join('\n'),
    );
  });
});
