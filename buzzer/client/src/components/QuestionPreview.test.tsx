// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { QuestionPreview } from './QuestionPreview.js';

afterEach(cleanup);

function q(id: string, overrides: Partial<Question> = {}): Question {
  return { id, text: `Question ${id}`, answer: `Answer ${id}`, points: 100, ...overrides };
}

function set(questions: Question[]): QuestionSet {
  return { id: 's', title: 'Quiz', questions, createdAt: 1, updatedAt: 2, schemaVersion: 1 };
}

/** The editor's side of the preview: it owns the index and unmounts the preview on close. */
function Harness({ questions, onClose }: { questions: Question[]; onClose?: () => void }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  if (!open) return <button onClick={() => setOpen(true)}>Reopen</button>;
  return (
    <QuestionPreview
      set={set(questions)}
      index={index}
      onIndex={setIndex}
      onClose={() => {
        onClose?.();
        setOpen(false);
      }}
    />
  );
}

const toggle = () => screen.getByRole('button', { name: 'Show answer' }) as HTMLButtonElement;
const answer = () => screen.queryByRole('region', { name: 'Answer' });

describe('QuestionPreview Show answer', () => {
  it('starts off, with buzzers locked and no answer', () => {
    render(<Harness questions={[q('a', { hostNotes: 'Secret notes' })]} />);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('Buzzers locked');
    expect(answer()).toBeNull();
    expect(screen.getByRole('dialog').textContent).not.toContain('Answer a');
  });

  it('the button shows the reveal: the answer under the question, no notes and no scorer', () => {
    render(<Harness questions={[q('a', { hostNotes: 'Secret notes' })]} />);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Question a');
    expect(answer()!.textContent).toBe('AnswerAnswer a');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog').textContent).not.toContain('Secret notes');
    expect(screen.getByRole('dialog').textContent).not.toContain('✓');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(answer()).toBeNull();
  });

  it('the A key toggles it, in either case, but not with a modifier or on key repeat', () => {
    render(<Harness questions={[q('a')]} />);
    fireEvent.keyDown(window, { key: 'a' });
    expect(answer()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'A' });
    expect(answer()).toBeNull();
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'a', metaKey: true });
    fireEvent.keyDown(window, { key: 'a', altKey: true });
    fireEvent.keyDown(window, { key: 'a', repeat: true });
    expect(answer()).toBeNull();
  });

  it('Previous and Next, by button or arrow key, turn it off', () => {
    render(<Harness questions={[q('a'), q('b')]} />);
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Question b');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(answer()).toBeNull();

    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Question a');
    expect(answer()).toBeNull();

    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(answer()).toBeNull();
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(answer()).toBeNull();
  });

  it('an arrow key at the end of the set leaves it on', () => {
    render(<Harness questions={[q('a')]} />);
    fireEvent.click(toggle());
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(answer()).not.toBeNull();
  });

  it('closing turns it off for the next opening', () => {
    const onClose = vi.fn();
    render(<Harness questions={[q('a')]} onClose={onClose} />);
    fireEvent.click(toggle());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(answer()).toBeNull();
  });

  it('a question with no answer has the toggle disabled, and A does nothing', () => {
    render(<Harness questions={[q('a', { answer: '   ' }), q('b')]} />);
    expect(toggle().disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'a' });
    expect(answer()).toBeNull();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(toggle().disabled).toBe(false);
  });
});
