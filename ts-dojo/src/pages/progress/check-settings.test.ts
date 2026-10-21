// An imported file's compiler defaults pass the same TypeScript check as a Save on /settings
// (F10); options TypeScript refuses are left out of the import with the reasons.
import { describe, expect, it } from 'vitest';
import type { ImportFile } from '@/store/import';
import { checkImportedCompilerDefaults } from './check-settings';

const fileWith = (settings: unknown) =>
  ({ settings, lessons: [] }) as unknown as ImportFile;

describe('checkImportedCompilerDefaults', () => {
  it('keeps the file as it is when it has no compiler defaults, or TypeScript accepts them', async () => {
    const asked: unknown[] = [];
    const check = (options: unknown) => {
      asked.push(options);
      return Promise.resolve([]);
    };
    const none = fileWith({ theme: 'dark' });
    expect(await checkImportedCompilerDefaults(none, {}, check)).toEqual({
      file: none,
      refused: [],
    });
    const good = fileWith({ compilerDefaults: { strict: false } });
    expect(await checkImportedCompilerDefaults(good, {}, check)).toEqual({
      file: good,
      refused: [],
    });
    expect(asked).toEqual([{ strict: false }]);
  });

  it('leaves out compiler defaults TypeScript refuses, and the rest of the settings stays', async () => {
    const file = fileWith({ theme: 'dark', compilerDefaults: { foo: true } });
    const result = await checkImportedCompilerDefaults(file, {}, () =>
      Promise.resolve(["Unknown compiler option 'foo'."]),
    );
    expect(result.refused).toEqual(["Unknown compiler option 'foo'."]);
    expect(result.file.settings).toEqual({ theme: 'dark' });
    expect(result.file.lessons).toBe(file.lessons);
    expect(file.settings).toEqual({
      theme: 'dark',
      compilerDefaults: { foo: true },
    });
  });

  it('leaves them out too when the check itself fails', async () => {
    const result = await checkImportedCompilerDefaults(
      fileWith({ compilerDefaults: { strict: false } }),
      {},
      () => Promise.reject(new Error('the ts-ls worker restarted')),
    );
    expect(result.refused).toEqual([
      'TypeScript could not check them (the ts-ls worker restarted)',
    ]);
    expect(result.file.settings).toEqual({});
  });

  it("keeps the compiler defaults already here when the file's are left out: the import replaces the settings, not these", async () => {
    const result = await checkImportedCompilerDefaults(
      fileWith({ theme: 'dark', compilerDefaults: { foo: true } }),
      { theme: 'light', compilerDefaults: { noUncheckedIndexedAccess: true } },
      () => Promise.resolve(["Unknown compiler option 'foo'."]),
    );
    expect(result.file.settings).toEqual({
      theme: 'dark',
      compilerDefaults: { noUncheckedIndexedAccess: true },
    });
  });
});
