import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The runtime image installs `dependencies` only (`npm ci --omit=dev`), so that list must be
// exactly what `dist/server` imports: tsconfig.build.json compiles server/ and shared/, minus
// tests and server/test.
const root = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => join(dir, file))
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => !file.startsWith(join('server', 'test')));
}

function packageName(specifier: string): string {
  return specifier.split('/', specifier.startsWith('@') ? 2 : 1).join('/');
}

function runtimeImports(): string[] {
  const names = new Set<string>();
  for (const file of [...sourceFiles('server'), ...sourceFiles('shared')]) {
    const source = readFileSync(join(root, file), 'utf8');
    const imports = source.matchAll(/(?:from|import)\s*\(?\s*(['"])([^'".][^'"]*)\1/g);
    for (const [, , specifier = ''] of imports) {
      if (specifier && !specifier.startsWith('node:')) names.add(packageName(specifier));
    }
  }
  return [...names].sort();
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('package.json dependencies', () => {
  it('lists exactly the packages the production server imports', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(runtimeImports());
  });

  it('keeps client-only libraries out of the runtime image', () => {
    for (const name of ['react', 'react-dom', 'react-router', 'dexie', 'howler', 'zustand']) {
      expect(pkg.dependencies).not.toHaveProperty(name);
      expect(pkg.devDependencies).toHaveProperty(name);
    }
  });

  it('skips the test harness, which imports socket.io-client', () => {
    expect(sourceFiles('server')).not.toContain(join('server', 'test', 'sockets.ts'));
    expect(runtimeImports()).not.toContain('socket.io-client');
  });
});
