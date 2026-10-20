// The exercise prompt as a build-time module (§1 "prompt (Markdown)", §2 "No content is fetched
// at runtime"): `exercise.yaml?prompt` resolves to a virtual `…/exercise.yaml.prompt.md` id that
// the MDX compiler takes as plain Markdown, whose source is the YAML's `prompt` field.
import { describe, expect, it } from 'vitest';
import {
  PROMPT_QUERY,
  isPromptId,
  promptId,
  promptSource,
} from './vite-plugin';

describe('the prompt module', () => {
  it('names a virtual .md id next to the exercise.yaml, and recognises it', () => {
    const yaml = '/repo/content/modules/m/l/exercises/01-x/exercise.yaml';
    expect(PROMPT_QUERY).toBe('?prompt');
    expect(promptId(yaml)).toBe(`${yaml}.prompt.md`);
    expect(isPromptId(promptId(yaml))).toBe(true);
    expect(isPromptId(yaml)).toBe(false);
    expect(isPromptId('/repo/content/modules/m/l/lesson.mdx')).toBe(false);
  });

  it('is the prompt field of an editor exercise, and empty for a predict exercise', () => {
    expect(
      promptSource(
        'id: m/l/01-x\nkind: implement\ntitle: T\nminutes: 3\nprompt: |\n  Write `area`:\n\n  - a list item\n',
      ),
    ).toBe('Write `area`:\n\n- a list item\n');
    expect(
      promptSource(
        'id: m/l/02-y\nkind: predict\ntitle: T\nminutes: 1\nquestion: Q\noptions: [a, b]\nanswer: 0\nexplanation: E\n',
      ),
    ).toBe('');
    expect(promptSource('not: [valid')).toBe('');
  });
});
