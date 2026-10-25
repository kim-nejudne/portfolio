// /repl compiles every buffer as its own module (Kim's decision on 22 October 2026, Spec
// questions "/repl buffers are one project"), so two scratch snippets that declare the same
// name don't clash. The Settings compiler defaults still go over it: Kim's own choice wins.
import { describe, expect, it } from 'vitest';
import { replCompilerOptions } from './repl-options';

describe('replCompilerOptions', () => {
  it('makes every buffer a module', () => {
    expect(replCompilerOptions(undefined)).toEqual({
      moduleDetection: 'force',
    });
  });

  it('keeps the Settings compiler defaults, which win over it', () => {
    expect(replCompilerOptions({ noUncheckedIndexedAccess: true })).toEqual({
      moduleDetection: 'force',
      noUncheckedIndexedAccess: true,
    });
    expect(replCompilerOptions({ moduleDetection: 'auto' })).toEqual({
      moduleDetection: 'auto',
    });
  });
});
