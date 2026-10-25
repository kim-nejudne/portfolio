import type { Equal, Expect } from '@dojo/type-utils';
import {
  loadSettings,
  NotFoundError,
  type ReadFile,
  type Result,
  type Settings,
  type SettingsError,
} from './index';

type cases = [
  Expect<
    Equal<
      Awaited<ReturnType<typeof loadSettings>>,
      Result<Settings, SettingsError>
    >
  >, // loadSettings resolves to a Result
];

/** A fake read over `files`: a missing path rejects with a NotFoundError. */
function readFrom(files: Record<string, string>): ReadFile {
  return async (path) => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
    const text = files[path];
    if (text === undefined) {
      throw new NotFoundError(path);
    }
    return text;
  };
}

/** Resolves to the rejection reason, or to an object holding what it resolved with. */
function outcome(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => ({ resolved: value }),
    (reason: unknown) => ({ rejected: reason }),
  );
}

function syntaxMessage(text: string): string {
  try {
    JSON.parse(text);
  } catch (error) {
    if (error instanceof Error) return error.message;
  }
  throw new Error(`${text} parsed`);
}

test('loadSettings resolves to the settings in a valid file', async () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const fontSize of [8, 12, 14.5, 0, 72]) {
      const read = readFrom({
        'editor.json': JSON.stringify({ theme, fontSize }),
      });
      await expect(loadSettings(read, 'editor.json')).resolves.toEqual({
        ok: true,
        value: { theme, fontSize },
      });
    }
  }
});

test('loadSettings keeps only theme and fontSize', async () => {
  const read = readFrom({
    'a.json': '{"fontSize": 16, "theme": "dark", "tabs": 2, "font": "mono"}',
  });
  await expect(loadSettings(read, 'a.json')).resolves.toEqual({
    ok: true,
    value: { theme: 'dark', fontSize: 16 },
  });
});

test('loadSettings reports a missing file with the path asked for', async () => {
  const read = readFrom({ 'a.json': '{"theme":"dark","fontSize":12}' });
  for (const path of ['b.json', 'settings/editor.json', '']) {
    await expect(loadSettings(read, path)).resolves.toEqual({
      ok: false,
      error: { kind: 'missing', path },
    });
  }
});

test('loadSettings reports text that is not JSON, with the message of JSON.parse', async () => {
  for (const text of ['{', '{"theme": dark}', '', 'theme=dark', '[1,]']) {
    const read = readFrom({ 'a.json': text });
    await expect(loadSettings(read, 'a.json')).resolves.toEqual({
      ok: false,
      error: { kind: 'syntax', message: syntaxMessage(text) },
    });
  }
});

test('loadSettings reports a bad theme', async () => {
  for (const text of [
    'null',
    '42',
    '"dark"',
    '[]',
    '{}',
    '{"fontSize": 12}',
    '{"theme": "blue", "fontSize": 12}',
    '{"theme": "Dark", "fontSize": 12}',
    '{"theme": null, "fontSize": 12}',
    '{"theme": "", "fontSize": "12"}',
  ]) {
    const read = readFrom({ 'a.json': text });
    await expect(loadSettings(read, 'a.json')).resolves.toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'theme' },
    });
  }
});

test('loadSettings reports a bad fontSize once the theme is right', async () => {
  for (const text of [
    '{"theme": "dark"}',
    '{"theme": "light", "fontSize": "12"}',
    '{"theme": "dark", "fontSize": null}',
    '{"theme": "light", "fontSize": [12]}',
    '{"theme": "dark", "fontSize": true}',
  ]) {
    const read = readFrom({ 'a.json': text });
    await expect(loadSettings(read, 'a.json')).resolves.toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'fontSize' },
    });
  }
});

test('loadSettings rejects with the same reason when read fails unexpectedly', async () => {
  for (const reason of [
    new Error('disk on fire'),
    new TypeError('bad handle'),
    'EACCES',
    { code: 13 },
  ]) {
    const read: ReadFile = () => Promise.reject(reason);
    const result = await outcome(loadSettings(read, 'a.json'));
    expect(result).toEqual({ rejected: reason });
    if (typeof result === 'object' && result !== null && 'rejected' in result) {
      expect(result.rejected).toBe(reason);
    }
  }
});
