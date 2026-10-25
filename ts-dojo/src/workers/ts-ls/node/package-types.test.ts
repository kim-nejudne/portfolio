// §12 F14 "Zod and React's types pre-bundled for 17.2 and 17.4": the declaration files the
// ts-ls worker mounts are every file TypeScript reads for zod and for React's JSX types, at
// stable /node_modules/ paths, with each package's package.json; valibot only on request (the
// build's twoslash renderer).
import { describe, expect, it } from 'vitest';
import {
  PACKAGES_ROOT,
  REACT_TYPES_VERSION,
  ZOD_VERSION,
} from '@/protocol/packages';
import { collectPackageTypes } from './package-types';

describe('collectPackageTypes (§12 F14)', () => {
  it('holds zod, @types/react and csstype under /node_modules/, with their package.json files, sorted', () => {
    const files = collectPackageTypes();
    const paths = files.map((f) => f.path);
    expect(paths.every((p) => p.startsWith(PACKAGES_ROOT))).toBe(true);
    expect(paths).toEqual([...paths].sort());
    for (const p of [
      '/node_modules/zod/package.json',
      '/node_modules/zod/index.d.cts',
      '/node_modules/@types/react/package.json',
      '/node_modules/@types/react/index.d.ts',
      '/node_modules/@types/react/jsx-runtime.d.ts',
      '/node_modules/csstype/package.json',
      '/node_modules/csstype/index.d.ts',
    ]) {
      expect(paths).toContain(p);
    }
    const packages = new Set(
      paths.map((p) => {
        const parts = p.slice(PACKAGES_ROOT.length).split('/');
        return parts[0]?.startsWith('@')
          ? `${parts[0]}/${parts[1] ?? ''}`
          : parts[0];
      }),
    );
    expect([...packages].sort()).toEqual(['@types/react', 'csstype', 'zod']);
    expect(paths.some((p) => p.includes('valibot'))).toBe(false);
  });

  it('is the same set every time it is collected', () => {
    const first = collectPackageTypes().map((f) => f.path);
    expect(first).toEqual(collectPackageTypes().map((f) => f.path));
  });

  it('adds a build-only extra package when asked (valibot, for twoslash)', () => {
    const paths = collectPackageTypes(['valibot']).map((f) => f.path);
    expect(paths).toContain('/node_modules/valibot/package.json');
    expect(paths).toContain('/node_modules/zod/index.d.cts');
  });
});

describe('the package table names the installed versions', () => {
  it('ZOD_VERSION and REACT_TYPES_VERSION are the versions in node_modules', () => {
    const files = collectPackageTypes();
    const versionOf = (name: string): unknown => {
      const text = files.find(
        (f) => f.path === `${PACKAGES_ROOT}${name}/package.json`,
      )?.text;
      return (JSON.parse(text ?? '{}') as { version?: unknown }).version;
    };
    // The bundle's file name carries ZOD_VERSION: an upgrade must change both.
    expect(versionOf('zod')).toBe(ZOD_VERSION);
    expect(versionOf('@types/react')).toBe(REACT_TYPES_VERSION);
  });
});
