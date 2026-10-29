// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionSet } from '../../../shared/types.js';
import { SetPreview } from './SetPreview.js';

const set: QuestionSet = {
  schemaVersion: 1,
  id: 'set-flags',
  title: 'Flags of the world',
  category: 'Geography',
  difficulty: 'medium',
  createdAt: 0,
  updatedAt: 0,
  questions: [
    { id: 'q1', text: 'Which country has a maple leaf?', answer: 'Canada', points: 100 },
    {
      id: 'q2',
      text: '',
      imageId: 'img-flag',
      answer: 'Japan',
      hostNotes: 'Accept Nippon',
      points: 300,
    },
    { id: 'q3', text: 'Whose flag is this?', imageId: 'img-gone', answer: '', points: 200 },
  ],
};

// Pictures by id; `img-gone` is not in this browser. Stable, as `imagesOf` is.
const loadImage = vi.fn(async (id: string) => (id === 'img-flag' ? new Blob(['flag']) : undefined));

let revoked: string[];

beforeEach(() => {
  revoked = [];
  // jsdom has no object URLs.
  Object.assign(URL, {
    createObjectURL: () => 'blob:flag',
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPreview() {
  const onAction = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <SetPreview
      set={set}
      actionLabel="Pick this set"
      onAction={onAction}
      onClose={onClose}
      loadImage={loadImage}
    />,
  );
  return { onAction, onClose, unmount: view.unmount };
}

const dialog = () => screen.getByRole('dialog', { name: 'Flags of the world' });
const question = (n: number) => within(dialog()).getByRole('listitem', { name: `Question ${n}` });

describe('SetPreview', () => {
  it('lists every question with its points, text, answer and host notes, and the set details', () => {
    renderPreview();
    expect(within(dialog()).getByText('Geography · 3 questions · Medium')).toBeTruthy();
    expect(within(dialog()).getAllByRole('listitem')).toHaveLength(3);
    expect(question(1).textContent).toBe(
      'Question 1 · 100 pointsWhich country has a maple leaf?Answer: Canada',
    );
    expect(question(2).textContent).toContain('Question 2 · 300 points');
    expect(question(2).textContent).toContain('No question text');
    expect(question(2).textContent).toContain('Answer: Japan');
    expect(question(2).textContent).toContain('Host notes: Accept Nippon');
    expect(question(3).textContent).toContain('Answer: none yet');
    expect(question(3).textContent).not.toContain('Host notes');
  });

  it("shows each question's picture as a thumbnail, and says when one is missing", async () => {
    const { unmount } = renderPreview();
    const image = await within(question(2)).findByRole<HTMLImageElement>('img', {
      name: 'Picture for question 2',
    });
    expect(image.src).toBe('blob:flag');
    expect(
      await within(question(3)).findByText('The picture is missing from this browser.'),
    ).toBeTruthy();
    expect(within(question(1)).queryByRole('img')).toBeNull();
    expect(loadImage.mock.calls.map(([id]) => id)).toEqual(['img-flag', 'img-gone']);
    unmount();
    expect(revoked).toEqual(['blob:flag']);
  });

  it('the action button closes the preview and acts on the set', () => {
    const { onAction, onClose } = renderPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Pick this set' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith(set);
  });

  it('Close and Escape close it without acting, and focus returns to the opener', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { onAction, onClose, unmount } = renderPreview();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading')));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onAction).not.toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
