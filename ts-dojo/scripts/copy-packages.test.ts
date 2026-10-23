// §12 F14 "Zod and React's types pre-bundled for 17.2 and 17.4": public/packages/ holds the
// declaration files the ts-ls worker mounts and Zod as one self-contained ES module that runs
// (the sandbox imports it by URL), and nothing else.
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PACKAGES, ZOD_VERSION } from '@/protocol/packages';
import { collectPackageTypes } from '@/workers/ts-ls/node/package-types';
import { copyPackages } from './copy-packages.ts';

let dir: string;
let result: Awaited<ReturnType<typeof copyPackages>>;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'dojo-packages-'));
  writeFileSync(path.join(dir, 'zod-3.0.0.js'), 'stale');
  result = await copyPackages(dir);
}, 120_000);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('copyPackages (§12 F14)', () => {
  it('writes types.json and zod-<version>.js, and removes a stale bundle', () => {
    expect(readdirSync(dir).sort()).toEqual([
      'types.json',
      `zod-${ZOD_VERSION}.js`,
    ]);
    expect(result.files.map((f) => f.name).sort()).toEqual([
      'types.json',
      `zod-${ZOD_VERSION}.js`,
    ]);
    expect(PACKAGES.find((p) => p.name === 'zod')?.runtimeUrl).toBe(
      `/packages/zod-${ZOD_VERSION}.js`,
    );
  });

  it('types.json is exactly the collected declaration files', () => {
    const written = JSON.parse(
      readFileSync(path.join(dir, 'types.json'), 'utf8'),
    ) as unknown;
    expect(written).toEqual(collectPackageTypes());
  });

  it('the Zod bundle imports nothing and parses as zod does, through named and default exports', async () => {
    const file = path.join(dir, `zod-${ZOD_VERSION}.js`);
    const code = readFileSync(file, 'utf8');
    expect(code).not.toMatch(/\bfrom\s*["'][^"'./]/);
    expect(code).not.toMatch(/\bimport\s*\(/);
    const bundle = (await import(pathToFileURL(file).href)) as {
      z: { string: () => { parse: (v: unknown) => unknown } };
      default: unknown;
      ZodError: unknown;
    };
    expect(bundle.z.string().parse('ok')).toBe('ok');
    expect(bundle.default).toBe(bundle.z);
    expect(typeof bundle.ZodError).toBe('function');
  });
});
