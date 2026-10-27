// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_QUESTIONS_PER_SET, QUESTION_TEXT_MAX } from '../../../shared/constants.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { AUTOSAVE_DELAY_MS } from '../lib/autosave.js';
import { db, getSet } from '../lib/db.js';
import { POINTS_ERROR, QUESTION_CAP_MESSAGE } from '../lib/setEditor.js';
import { SetEditor } from './SetEditor.js';

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  // Dexie and fake-indexeddb schedule with timers too, so faked time also follows real time.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  await db.delete();
  await db.open();
  await db.sets.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function q(id: string, overrides: Partial<Question> = {}): Question {
  return { id, text: `Question ${id}`, answer: `Answer ${id}`, points: 100, ...overrides };
}

async function seed(questions: Question[], title = 'Quiz'): Promise<QuestionSet> {
  const set: QuestionSet = {
    id: 'set-1',
    title,
    questions,
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1,
  };
  await db.sets.add(set);
  return set;
}

async function renderEditor(id = 'set-1') {
  const view = render(
    <MemoryRouter initialEntries={[`/sets/${id}`]}>
      <Routes>
        <Route path="/sets/:setId" element={<SetEditor />} />
      </Routes>
    </MemoryRouter>,
  );
  if (id === 'set-1') await screen.findByLabelText('Set title');
  return view;
}

async function settle() {
  await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
}

const card = (number: number) =>
  within(screen.getByRole('listitem', { name: `Question ${number}` }));
const type = (label: HTMLElement, value: string) => fireEvent.change(label, { target: { value } });

describe('Set editor /sets/:setId', () => {
  it('loads the title and a card per question with text, answer, host notes and points', async () => {
    await seed([q('a', { hostNotes: 'Also: A' }), q('b', { points: 250 })]);
    await renderEditor();
    expect((screen.getByLabelText('Set title') as HTMLInputElement).value).toBe('Quiz');
    expect((card(1).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question a');
    expect((card(1).getByLabelText('Answer') as HTMLInputElement).value).toBe('Answer a');
    expect((card(1).getByLabelText('Host notes (optional)') as HTMLTextAreaElement).value).toBe(
      'Also: A',
    );
    expect((card(2).getByLabelText('Points') as HTMLInputElement).value).toBe('250');
  });

  it('autosaves 500 ms after the last change, then shows Saved', async () => {
    await seed([q('a')]);
    await renderEditor();
    type(screen.getByLabelText('Set title'), 'Capitals');
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100));
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    await settle();
    expect(await getSet('set-1')).toMatchObject({ title: 'Capitals', updatedAt: NOW });
  });

  it('edits survive closing and reopening the editor', async () => {
    await seed([q('a')]);
    const view = await renderEditor();
    type(card(1).getByLabelText('Question'), 'Capital of France?');
    type(card(1).getByLabelText('Answer'), 'Paris');
    type(card(1).getByLabelText('Host notes (optional)'), 'Also: Lutetia');
    type(card(1).getByLabelText('Points'), '300');
    // Leaving before the debounce still writes the change.
    view.unmount();
    await waitFor(async () =>
      expect((await getSet('set-1'))!.questions).toEqual([
        {
          id: 'a',
          text: 'Capital of France?',
          answer: 'Paris',
          hostNotes: 'Also: Lutetia',
          points: 300,
        },
      ]),
    );
    await renderEditor();
    expect((card(1).getByLabelText('Answer') as HTMLInputElement).value).toBe('Paris');
  });

  it('a change still waiting is written when the page is hidden', async () => {
    await seed([q('a')]);
    await renderEditor();
    type(screen.getByLabelText('Set title'), 'Closing tab');
    window.dispatchEvent(new Event('pagehide'));
    // Well inside the 500 ms debounce, so only the pagehide flush can have written it.
    await waitFor(async () => expect((await getSet('set-1'))!.title).toBe('Closing tab'), {
      timeout: 200,
    });
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('clearing host notes removes them from the saved question', async () => {
    await seed([q('a', { hostNotes: 'n' })]);
    await renderEditor();
    type(card(1).getByLabelText('Host notes (optional)'), '');
    await settle();
    expect((await getSet('set-1'))!.questions[0]).not.toHaveProperty('hostNotes');
  });

  it('shows inline errors once a field is left: answer and question required, title required', async () => {
    await seed([q('a')]);
    await renderEditor();
    const answer = card(1).getByLabelText('Answer');
    type(answer, '');
    expect(card(1).queryByText('The answer is required.')).toBeNull();
    fireEvent.blur(answer);
    expect(card(1).getByText('The answer is required.')).toBeTruthy();
    expect(answer.getAttribute('aria-invalid')).toBe('true');

    const text = card(1).getByLabelText('Question');
    type(text, ' ');
    fireEvent.blur(text);
    expect(card(1).getByText('Write the question, or add an image.')).toBeTruthy();

    const title = screen.getByLabelText('Set title');
    type(title, '');
    fireEvent.blur(title);
    expect(screen.getByText('The set needs a title.')).toBeTruthy();
    // Drafts are still saved.
    await settle();
    expect((await getSet('set-1'))!.questions[0]).toMatchObject({ text: ' ', answer: '' });
  });

  it('caps text fields at the spec limits', async () => {
    await seed([q('a')]);
    await renderEditor();
    const text = card(1).getByLabelText('Question') as HTMLTextAreaElement;
    expect(text.maxLength).toBe(QUESTION_TEXT_MAX);
    expect((screen.getByLabelText('Set title') as HTMLInputElement).maxLength).toBe(100);
    expect((card(1).getByLabelText('Answer') as HTMLInputElement).maxLength).toBe(200);
    expect((card(1).getByLabelText('Host notes (optional)') as HTMLTextAreaElement).maxLength).toBe(
      500,
    );
  });

  it('refuses points that are not a whole number from 0 to 10000, and keeps the last valid value', async () => {
    await seed([q('a', { points: 200 })]);
    await renderEditor();
    const points = card(1).getByLabelText('Points');
    type(points, '12.5');
    expect(card(1).getByText(POINTS_ERROR)).toBeTruthy();
    type(points, '20000');
    expect(card(1).getByText(POINTS_ERROR)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    expect((await getSet('set-1'))!.questions[0]!.points).toBe(200);
    type(points, '50');
    expect(card(1).queryByText(POINTS_ERROR)).toBeNull();
    await settle();
    expect((await getSet('set-1'))!.questions[0]!.points).toBe(50);
  });

  it('moves a question up and down; the first cannot go up nor the last down', async () => {
    await seed([q('a'), q('b'), q('c')]);
    await renderEditor();
    expect(
      (card(1).getByRole('button', { name: 'Move question 1 up' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (card(3).getByRole('button', { name: 'Move question 3 down' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(card(1).getByRole('button', { name: 'Move question 1 down' }));
    fireEvent.click(card(3).getByRole('button', { name: 'Move question 3 up' }));
    await settle();
    expect((await getSet('set-1'))!.questions.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect((card(1).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question b');
  });

  it('duplicates a question below the original and deletes one after a second tap', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    fireEvent.click(card(1).getByRole('button', { name: 'Duplicate question 1' }));
    expect((card(2).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question a');

    fireEvent.click(card(3).getByRole('button', { name: 'Delete question 3' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(card(3).getByRole('button', { name: 'Confirm delete' }));
    await settle();
    const saved = (await getSet('set-1'))!.questions;
    expect(saved.map((x) => x.text)).toEqual(['Question a', 'Question a']);
    expect(saved[0]!.id).not.toBe(saved[1]!.id);
  });

  it('Add question appends an empty card worth 100 points and focuses it', async () => {
    await seed([]);
    await renderEditor();
    expect(screen.getByText(/No questions yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    expect(document.activeElement).toBe(card(1).getByLabelText('Question'));
    expect((card(1).getByLabelText('Points') as HTMLInputElement).value).toBe('100');
    await settle();
    expect((await getSet('set-1'))!.questions).toMatchObject([
      { text: '', answer: '', points: 100 },
    ]);
  });

  it('stops at 100 questions: Add question and Duplicate are disabled', async () => {
    await seed(Array.from({ length: MAX_QUESTIONS_PER_SET }, (_, i) => q(`q${i}`)));
    await renderEditor();
    expect(
      (screen.getByRole('button', { name: 'Add question' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(QUESTION_CAP_MESSAGE)).toBeTruthy();
    expect(
      (card(1).getByRole('button', { name: 'Duplicate question 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('says so when the set no longer exists', async () => {
    await renderEditor('gone');
    expect((await screen.findByRole('alert')).textContent).toBe('This set no longer exists.');
  });
});
