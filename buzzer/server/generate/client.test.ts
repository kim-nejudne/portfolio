import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicClient } from './client.js';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

function serverSources(): { file: string; source: string }[] {
  return readdirSync(serverDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file))
    .map((file) => ({ file, source: readFileSync(join(serverDir, file), 'utf8') }));
}

describe('the Anthropic client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses only the key it is given, never the SDK’s environment defaults', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-from-claude-cli');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'oauth-token-from-ant');
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://proxy.example');
    const client = createAnthropicClient('sk-ant-buzzr');
    expect(client.apiKey).toBe('sk-ant-buzzr');
    expect(client.authToken).toBeNull();
    expect(client.baseURL).toBe('https://api.anthropic.com');
  });

  it('is built nowhere else, and never bare', () => {
    const builders = serverSources().filter(({ source }) => /new Anthropic\s*\(/.test(source));
    expect(builders.map(({ file }) => file)).toEqual([join('generate', 'client.ts')]);
    expect(builders[0]!.source).not.toMatch(/new Anthropic\s*\(\s*\)/);
  });

  it('reads no SDK credential variable anywhere in the server', () => {
    for (const { file, source } of serverSources()) {
      expect(source, file).not.toMatch(/process\.env\.ANTHROPIC_|env\[['"]ANTHROPIC_/);
    }
  });
});
