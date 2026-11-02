import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(new URL('../deploy/compose.deploy.yaml', import.meta.url), 'utf8');
/** The compose file without its comments: what Docker actually reads. */
const settings = compose
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

describe('deploy/compose.deploy.yaml (F112)', () => {
  it('passes the generator key and daily limit from the box’s .env, like the admin hash', () => {
    expect(settings).toMatch(/^ {6}ADMIN_PASSWORD_HASH: \$\{ADMIN_PASSWORD_HASH:-\}$/m);
    expect(settings).toMatch(/^ {6}BUZZR_ANTHROPIC_API_KEY: \$\{BUZZR_ANTHROPIC_API_KEY:-\}$/m);
    expect(settings).toMatch(/^ {6}GENERATE_DAILY_LIMIT: \$\{GENERATE_DAILY_LIMIT:-20\}$/m);
    expect(settings).toMatch(
      /^ {6}GENERATE_REPLACE_DAILY_LIMIT: \$\{GENERATE_REPLACE_DAILY_LIMIT:-100\}$/m,
    );
  });

  it('never passes GENERATE_FAKE or another Anthropic variable', () => {
    expect(settings).not.toMatch(/GENERATE_FAKE/);
    expect(settings).not.toMatch(/(?<!BUZZR_)ANTHROPIC_/);
  });
});
