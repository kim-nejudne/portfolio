// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { QuestionSet } from '../../../shared/types.js';
import { SetPicker } from './SetPicker.js';

afterEach(cleanup);

const set: QuestionSet = {
  schemaVersion: 1,
  id: 'draft',
  title: 'Half done',
  difficulty: 'easy',
  createdAt: 0,
  updatedAt: 0,
  questions: [],
};

function renderPicker() {
  return render(
    <SetPicker
      heading={<h2>Host a game</h2>}
      back={{ label: 'Back', onClick: () => {} }}
      browser={null}
      selected={{
        set,
        ticket: {
          emoji: '📝',
          kicker: 'Your set',
          title: 'Half done',
          chips: [
            { label: 'Easy', level: true },
            { label: '0 questions' },
            { label: 'Not playable yet' },
          ],
        },
      }}
      onPreview={() => {}}
      action={{ label: 'Create room', onClick: () => {}, disabled: false }}
    />,
  );
}

describe('SetPicker (F160)', () => {
  it("the phone's one-line summary joins two items at most: a draft's flag takes the count's place", () => {
    renderPicker();
    expect(screen.getByText('Easy · Not playable yet')).toBeTruthy();
  });

  it('underlines "Preview questions" as one run, and draws no dashed border', () => {
    const { container } = renderPicker();
    const preview = screen.getByRole('button', { name: 'Preview Half done' });
    // One child span holds both words, so the gap of the flex button can't split the underline.
    expect(preview.children).toHaveLength(1);
    expect(preview.textContent).toBe('Preview questions');
    expect(container.querySelector('[class*="dashed"]')).toBeNull();
  });
});
