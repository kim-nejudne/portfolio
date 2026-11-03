import { describe, expect, it } from 'vitest';
import { emojiSchema } from '../../../shared/schemas.js';
import { parseOtherEmoji, QUIZ_EMOJI } from './categoryEmoji.js';

describe('QUIZ_EMOJI', () => {
  it('holds 48 different emoji, each one the server takes', () => {
    expect(QUIZ_EMOJI).toHaveLength(48);
    expect(new Set(QUIZ_EMOJI).size).toBe(48);
    for (const emoji of QUIZ_EMOJI) expect(emojiSchema.safeParse(emoji).success, emoji).toBe(true);
  });
});

describe('parseOtherEmoji', () => {
  it('takes one emoji, trimmed, including sequences and flags', () => {
    expect(parseOtherEmoji(' 🦉 ')).toEqual({ emoji: '🦉' });
    expect(parseOtherEmoji('👩‍🔬')).toEqual({ emoji: '👩‍🔬' });
    expect(parseOtherEmoji('🇯🇵')).toEqual({ emoji: '🇯🇵' });
  });

  it('refuses text, two emoji and nothing', () => {
    for (const text of ['ab', '🦉🦉', '', '   ', 'x🦉']) {
      expect(parseOtherEmoji(text)).toEqual({ error: 'Type one emoji, such as 🦉.' });
    }
  });
});
