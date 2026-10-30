// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBuiltInSets } from '../lib/builtInSets.js';
import { serveSeededBuiltIns } from '../test/builtIns.js';
import {
  CHOICE_TEXT_MAX,
  MAX_QUESTIONS_PER_SET,
  QUESTION_TEXT_MAX,
  SET_CATEGORY_MAX,
} from '../../../shared/constants.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { AUTOSAVE_DELAY_MS } from '../lib/autosave.js';
import { db, getSet } from '../lib/db.js';
import { IMAGE_TOO_LARGE, shrinkImage } from '../lib/imagePipeline.js';
import { MISSING_ANSWER } from '../lib/bulkPaste.js';
import { POINTS_ERROR, QUESTION_CAP_MESSAGE } from '../lib/setEditor.js';
import { NodeBlob } from '../test/nodeBlob.js';
import { buttonsWithoutHover } from '../test/hover.js';
import { SetEditor } from './SetEditor.js';

// jsdom has no canvas to shrink with; the pipeline's own rules are in imagePipeline.test.ts.
vi.mock('../lib/imagePipeline.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/imagePipeline.js')>()),
  shrinkImage: vi.fn(),
}));

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  serveSeededBuiltIns();
  // Dexie and fake-indexeddb schedule with timers too, so faked time also follows real time.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  await db.delete();
  await db.open();
  await db.sets.clear();
});

afterEach(() => {
  resetBuiltInSets();
  // Unmounting flushes a change still waiting. Close first, so that write fails instead of racing
  // the next test's db.delete(), which hung that test's settle().
  db.close();
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
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saved'),
  );
}

const card = (number: number) =>
  within(screen.getByRole('listitem', { name: `Question ${number}` }));
const type = (label: HTMLElement, value: string) => fireEvent.change(label, { target: { value } });

/** Opens question `number`'s `⋯` menu (EDT-04) and returns its item `name`. */
function menuItem(number: number, name: string): HTMLElement {
  const trigger = card(number).getByRole('button', { name: `More actions for question ${number}` });
  if (trigger.getAttribute('aria-expanded') !== 'true') fireEvent.click(trigger);
  return card(number).getByRole('menuitem', { name });
}
const choose = (number: number, name: string) => fireEvent.click(menuItem(number, name));

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
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saving…');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100));
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saving…');
    await settle();
    expect(await getSet('set-1')).toMatchObject({ title: 'Capitals', updatedAt: NOW });
  });

  it('edits Category and Difficulty and autosaves them like the title', async () => {
    await seed([q('a')]);
    await renderEditor();
    const category = screen.getByLabelText('Category (optional)') as HTMLInputElement;
    const difficulty = screen.getByLabelText('Difficulty (optional)') as HTMLSelectElement;
    expect([category.value, difficulty.value]).toEqual(['', '']);
    expect([...difficulty.options].map((o) => o.text)).toEqual(['None', 'Easy', 'Medium', 'Hard']);
    expect(category.maxLength).toBe(SET_CATEGORY_MAX);

    type(category, 'Geography');
    fireEvent.change(difficulty, { target: { value: 'medium' } });
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saving…');
    await settle();
    expect(await getSet('set-1')).toMatchObject({ category: 'Geography', difficulty: 'medium' });

    cleanup();
    await renderEditor();
    expect((screen.getByLabelText('Category (optional)') as HTMLInputElement).value).toBe(
      'Geography',
    );
    expect((screen.getByLabelText('Difficulty (optional)') as HTMLSelectElement).value).toBe(
      'medium',
    );
  });

  it('trims the category when the field is left', async () => {
    await seed([q('a')]);
    await renderEditor();
    const category = screen.getByLabelText('Category (optional)') as HTMLInputElement;
    type(category, '  Pop Culture ');
    expect(category.value).toBe('  Pop Culture ');
    fireEvent.blur(category);
    expect(category.value).toBe('Pop Culture');
    await settle();
    expect((await getSet('set-1'))!.category).toBe('Pop Culture');
  });

  it('clearing Category and choosing None removes both from the saved set', async () => {
    await db.sets.add({
      id: 'set-1',
      title: 'Quiz',
      questions: [q('a')],
      createdAt: 1,
      updatedAt: 2,
      schemaVersion: 1,
      category: 'Science',
      difficulty: 'hard',
    });
    await renderEditor();
    type(screen.getByLabelText('Category (optional)'), '  ');
    fireEvent.change(screen.getByLabelText('Difficulty (optional)'), { target: { value: '' } });
    await settle();
    const saved = await getSet('set-1');
    expect(saved).not.toHaveProperty('category');
    expect(saved).not.toHaveProperty('difficulty');
  });

  it('suggests the categories in use in this browser and the built-in ones, each once', async () => {
    const other = (id: string, category: string): QuestionSet => ({
      id,
      title: id,
      questions: [],
      createdAt: 1,
      updatedAt: 1,
      schemaVersion: 1,
      category,
    });
    await db.sets.bulkAdd([
      other('x', 'Board games'),
      other('y', 'Animals'),
      // Listed last (oldest), so the first spelling wins.
      { ...other('z', 'board games'), updatedAt: 0 },
    ]);
    await seed([q('a')]);
    await renderEditor();
    const input = screen.getByLabelText('Category (optional)');
    const list = document.getElementById(input.getAttribute('list')!)!;
    const builtIn = [...new Set(STARTER_SETS.map((set) => set.category!))];
    await waitFor(() =>
      expect([...list.querySelectorAll('option')].map((o) => o.value)).toEqual(
        ['Board games', ...builtIn].sort((a, b) => a.localeCompare(b)),
      ),
    );
    expect(builtIn).toHaveLength(20);
  });

  it("suggests the server's built-in categories, and this browser's alone when they fail to load", async () => {
    const server = { ...STARTER_SETS[0]!, id: 'server-quiz', category: 'Server only' };
    resetBuiltInSets({ sets: [server], sampleHidden: false });
    await seed([q('a')]);
    const view = await renderEditor();
    const options = () => {
      const input = screen.getByLabelText('Category (optional)');
      const list = document.getElementById(input.getAttribute('list')!)!;
      return [...list.querySelectorAll('option')].map((o) => o.value);
    };
    await waitFor(() => expect(options()).toEqual(['Server only']));

    view.unmount();
    resetBuiltInSets();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Down' }, { status: 503 })),
    );
    await db.sets.add({ ...server, id: 'mine', category: 'Mine only' });
    await renderEditor();
    await waitFor(() => expect(options()).toEqual(['Mine only']));
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
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saved');
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
    expect(menuItem(1, 'Move up').getAttribute('aria-disabled')).toBe('true');
    // A disabled item does nothing and leaves the menu open.
    fireEvent.click(menuItem(1, 'Move up'));
    expect(card(1).getByRole('menu')).toBeTruthy();
    expect(menuItem(3, 'Move down').getAttribute('aria-disabled')).toBe('true');
    choose(1, 'Move down');
    // Choosing closes the menu and gives focus back to its button, on the card that moved.
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      card(2).getByRole('button', { name: 'More actions for question 2' }),
    );
    choose(3, 'Move up');
    await settle();
    expect((await getSet('set-1'))!.questions.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect((card(1).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question b');
  });

  it('duplicates a question below the original and deletes one after a second tap', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    choose(1, 'Duplicate');
    expect((card(2).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question a');

    choose(3, 'Delete');
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(3);
    choose(3, 'Confirm delete');
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
    expect(menuItem(1, 'Duplicate').getAttribute('aria-disabled')).toBe('true');
  });

  it('Paste questions previews the good lines and each bad one with its reason', async () => {
    await seed([q('a')]);
    await renderEditor();
    const toggle = screen.getByRole('button', { name: 'Paste questions' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const area = screen.getByLabelText('Questions to paste');
    expect(document.activeElement).toBe(area);
    type(
      area,
      'Capital of France? | Paris | 200\nNo answer\n\n Largest planet?  | Jupiter \nHalf? | yes | 1.5',
    );

    const found = within(screen.getByRole('list', { name: 'Questions found' }));
    expect(found.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Capital of France? · Paris · 200 pts',
      'Largest planet? · Jupiter · 100 pts',
    ]);
    expect(screen.getByText('2 questions found')).toBeTruthy();
    const skipped = within(screen.getByRole('list', { name: 'Lines skipped' }));
    expect(skipped.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `Line 2: ${MISSING_ANSWER}No answer`,
      `Line 5: ${POINTS_ERROR}Half? | yes | 1.5`,
    ]);
    expect(screen.getByText('2 lines skipped')).toBeTruthy();
    // Nothing is added until the button is pressed.
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(1);
  });

  it('Add N questions appends the good spreadsheet rows after the others and saves them', async () => {
    await seed([q('a')]);
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Paste questions' }));
    type(
      screen.getByLabelText('Questions to paste'),
      '"Who said ""Hi""?"\tBob\t300\nNo answer\t\t\n2 + 2?\t4\t',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 questions' }));

    expect(screen.queryByLabelText('Questions to paste')).toBeNull();
    expect(document.activeElement).toBe(card(2).getByLabelText('Question'));
    expect((card(2).getByLabelText('Question') as HTMLTextAreaElement).value).toBe(
      'Who said "Hi"?',
    );
    expect((card(3).getByLabelText('Points') as HTMLInputElement).value).toBe('100');
    await settle();
    const saved = (await getSet('set-1'))!.questions;
    expect(saved.map(({ text, answer, points }) => ({ text, answer, points }))).toEqual([
      { text: 'Question a', answer: 'Answer a', points: 100 },
      { text: 'Who said "Hi"?', answer: 'Bob', points: 300 },
      { text: '2 + 2?', answer: '4', points: 100 },
    ]);
    expect(new Set(saved.map((x) => x.id)).size).toBe(3);
  });

  it('Add N questions adds only what fits within 100 and says so', async () => {
    await seed(Array.from({ length: MAX_QUESTIONS_PER_SET - 1 }, (_, i) => q(`q${i}`)));
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Paste questions' }));
    type(screen.getByLabelText('Questions to paste'), 'One? | 1\nTwo? | 2\nThree? | 3');
    expect(screen.getByText('Only 1 more question fit: a set holds up to 100.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 question' }));
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(
      MAX_QUESTIONS_PER_SET,
    );
    expect(
      (card(MAX_QUESTIONS_PER_SET).getByLabelText('Question') as HTMLTextAreaElement).value,
    ).toBe('One?');
    expect(
      (screen.getByRole('button', { name: 'Paste questions' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await settle();
    expect((await getSet('set-1'))!.questions).toHaveLength(MAX_QUESTIONS_PER_SET);
  });

  it('Add stays disabled with nothing good to add, and Cancel closes without changes', async () => {
    await seed([q('a')]);
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Paste questions' }));
    const add = () => screen.getByRole('button', { name: /^Add \d+ questions?$/ });
    expect((add() as HTMLButtonElement).disabled).toBe(true);
    type(screen.getByLabelText('Questions to paste'), 'Only a question');
    expect((add() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Questions to paste')).toBeNull();
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(1);
  });

  it('each card has a drag handle that the keyboard can pick up', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    const handle = card(2).getByRole('button', { name: 'Drag to reorder question 2' });
    expect(handle.getAttribute('aria-roledescription')).toBe('sortable');
    expect(handle.tabIndex).toBe(0);
    // dnd-kit mounts its hidden instructions after the first render.
    await waitFor(() =>
      expect(
        document.getElementById(handle.getAttribute('aria-describedby')!)?.textContent,
      ).toMatch(/press Space or Enter on its handle/),
    );
  });

  it('dragging with the keyboard (Space, ↓, Space) moves the question and saves the order', async () => {
    await seed([q('a'), q('b'), q('c')]);
    await renderEditor();
    // jsdom has no layout: give each card a 200 px tall row so the sensor can find its neighbours.
    screen.getAllByRole('listitem', { name: /^Question \d+$/ }).forEach((item, i) => {
      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(
        DOMRect.fromRect({ x: 0, y: i * 220, width: 600, height: 200 }),
      );
    });
    const handle = card(1).getByRole('button', { name: 'Drag to reorder question 1' });
    handle.focus();
    fireEvent.keyDown(handle, { code: 'Space' });
    await act(() => vi.advanceTimersByTimeAsync(50));
    fireEvent.keyDown(handle, { code: 'ArrowDown' });
    await act(() => vi.advanceTimersByTimeAsync(50));
    fireEvent.keyDown(handle, { code: 'Space' });
    await act(() => vi.advanceTimersByTimeAsync(50));

    expect(card(1).getByRole('heading').textContent).toBe('Question 1');
    expect((card(1).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question b');
    expect((card(2).getByLabelText('Question') as HTMLTextAreaElement).value).toBe('Question a');
    await settle();
    expect((await getSet('set-1'))!.questions.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('Preview shows the question full screen as the Screen does, without the answer or notes', async () => {
    await seed([q('a', { hostNotes: 'Secret notes' }), q('b')]);
    await renderEditor();
    fireEvent.click(card(1).getByRole('button', { name: 'Preview question 1' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Preview of question 1' }));
    expect(dialog.getByRole('heading', { level: 1 }).textContent).toBe('Question a');
    expect(dialog.getByText('Question 1 / 2')).toBeTruthy();
    expect(dialog.getByRole('status').textContent).toBe('Buzzers locked');
    const text = screen.getByRole('dialog').textContent!;
    expect(text).not.toContain('Answer a');
    expect(text).not.toContain('Secret notes');
    expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Close' }));
  });

  it('Preview steps with Next and the arrow keys, and Escape closes it back to the card and page scroll', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    const open = card(1).getByRole('button', { name: 'Preview question 1' });
    open.focus();
    fireEvent.click(open);
    const dialog = () => within(screen.getByRole('dialog'));
    expect(
      (dialog().getByRole('button', { name: '← Previous' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(dialog().getByRole('button', { name: 'Next →' }));
    expect(dialog().getByRole('heading', { level: 1 }).textContent).toBe('Question b');
    expect((dialog().getByRole('button', { name: 'Next →' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(dialog().getByRole('heading', { level: 1 }).textContent).toBe('Question a');
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(open);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('links to the print answer sheet for this set', async () => {
    await seed([q('a')]);
    await renderEditor();
    expect(screen.getByRole('link', { name: 'Print answer sheet' }).getAttribute('href')).toBe(
      '/sets/set-1/print',
    );
  });

  it('every editor button and every Preview button has the hover style', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    expect(buttonsWithoutHover()).toEqual([]);
    fireEvent.click(card(1).getByRole('button', { name: 'Preview question 1' }));
    expect(buttonsWithoutHover(screen.getByRole('dialog'))).toEqual([]);
  });

  it('says so when the set no longer exists', async () => {
    await renderEditor('gone');
    expect((await screen.findByRole('alert')).textContent).toBe('This set no longer exists.');
  });
});

describe('Set editor toolbar and outline (F95)', () => {
  const toolbar = () => within(screen.getByRole('region', { name: 'Set toolbar' }));
  const outline = () => within(screen.getByRole('navigation', { name: 'Question outline' }));
  const scrolled: Element[] = [];

  beforeEach(() => {
    scrolled.length = 0;
    // jsdom does not scroll; record which element was asked to come into view.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('a sticky toolbar holds the save status, Add, Paste, Preview and Print', async () => {
    await seed([q('a')]);
    await renderEditor();
    expect(screen.getByRole('region', { name: 'Set toolbar' }).className).toContain('sticky');
    expect(toolbar().getByRole('status', { name: 'Save status' })).toBeTruthy();
    expect(toolbar().getByRole('button', { name: 'Add question' })).toBeTruthy();
    expect(toolbar().getByRole('button', { name: 'Paste questions' })).toBeTruthy();
    expect(toolbar().getByRole('button', { name: 'Preview set' })).toBeTruthy();
    expect(toolbar().getByRole('link', { name: 'Print answer sheet' }).getAttribute('href')).toBe(
      '/sets/set-1/print',
    );
    expect(toolbar().getByRole('link', { name: 'Question sets' }).getAttribute('href')).toBe(
      '/sets',
    );
  });

  it('on a phone Add question is a fixed bottom button and the rest wait in the ⋯ menu', async () => {
    await seed([q('a')]);
    await renderEditor();
    const add = toolbar().getByRole('button', { name: 'Add question' });
    expect(add.className).toMatch(/(^|\s)fixed(\s|$)/);
    expect(add.className).toContain('md:static');
    fireEvent.click(toolbar().getByRole('button', { name: 'More set actions' }));
    expect(
      toolbar()
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Paste questions', 'Preview set', 'Print answer sheet']);
    fireEvent.click(toolbar().getByRole('menuitem', { name: 'Paste questions' }));
    expect(screen.getByLabelText('Questions to paste')).toBeTruthy();
  });

  it('the title in the toolbar takes the cursor to the set title field', async () => {
    await seed([q('a')], 'Pub quiz');
    await renderEditor();
    // The visible title is the start of the button's name (label in name).
    fireEvent.click(toolbar().getByRole('button', { name: 'Pub quiz, go to the set title' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Set title'));
  });

  it('Preview set opens the preview at the first question, and is off with no questions', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    fireEvent.click(toolbar().getByRole('button', { name: 'Preview set' }));
    expect(screen.getByRole('dialog', { name: 'Preview of question 1' })).toBeTruthy();
    cleanup();
    await db.sets.clear();
    await seed([]);
    await renderEditor();
    expect(
      (toolbar().getByRole('button', { name: 'Preview set' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Add question brings the new card into view', async () => {
    await seed([q('a')]);
    await renderEditor();
    fireEvent.click(toolbar().getByRole('button', { name: 'Add question' }));
    expect(scrolled).toContain(screen.getByRole('listitem', { name: 'Question 2' }));
    expect(document.activeElement).toBe(card(2).getByLabelText('Question'));
  });

  it('Paste opens under the toolbar, above the questions, and scrolls into view', async () => {
    await seed([q('a')]);
    await renderEditor();
    fireEvent.click(toolbar().getByRole('button', { name: 'Paste questions' }));
    const panel = screen.getByRole('region', { name: 'Paste questions' });
    expect(scrolled).toContain(panel);
    const first = screen.getByRole('listitem', { name: 'Question 1' });
    expect(panel.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    type(screen.getByLabelText('Questions to paste'), 'One? | 1\nbad');
    // EDT-07: the result lists grow with the page; neither scrolls inside it.
    for (const name of ['Questions found', 'Lines skipped']) {
      expect(screen.getByRole('list', { name }).className).not.toContain('overflow');
    }
  });

  it('the outline lists each question with its number, text, mode and a dot when it needs attention', async () => {
    await seed([
      q('a', { text: 'Capital of France?' }),
      q('b', { mode: 'choice', choices: ['x', ''], correctChoice: 0, answer: 'x' }),
      q('c', { text: '', mode: 'typed' }),
    ]);
    await renderEditor();
    expect(
      outline()
        .getAllByRole('button')
        .map((entry) => entry.textContent),
    ).toEqual([
      '1Capital of France?Buzz',
      '2Needs attention:Question bChoice',
      '3Needs attention:(no text)Typed',
    ]);
  });

  it('clicking entry 25 of 30 scrolls card 25 into view and focuses its question', async () => {
    await seed(Array.from({ length: 30 }, (_, i) => q(`q${i + 1}`)));
    await renderEditor();
    fireEvent.click(outline().getAllByRole('button')[24]!);
    expect(scrolled).toEqual([screen.getByRole('listitem', { name: 'Question 25' })]);
    expect(document.activeElement).toBe(card(25).getByLabelText('Question'));
  });

  it('the outline marks the card in view', async () => {
    let report: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof report) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    await seed([q('a'), q('b'), q('c')]);
    await renderEditor();
    // The cards are watched from an effect after they render.
    await waitFor(() => expect(report).not.toBeNull());
    act(() =>
      report!([
        { target: screen.getByRole('listitem', { name: 'Question 2' }), isIntersecting: true },
      ]),
    );
    const entries = outline().getAllByRole('button');
    expect(entries.map((entry) => entry.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ]);
    vi.unstubAllGlobals();
  });

  it('the toolbar counts the questions that need attention and jumps to the first', async () => {
    await seed([q('a'), q('b', { answer: '' }), q('c', { text: '' })]);
    await renderEditor();
    fireEvent.click(toolbar().getByRole('button', { name: '2 questions need attention' }));
    expect(scrolled).toEqual([screen.getByRole('listitem', { name: 'Question 2' })]);
    expect(document.activeElement).toBe(card(2).getByLabelText('Question'));
    type(card(2).getByLabelText('Answer'), 'B');
    expect(toolbar().getByRole('button', { name: '1 question needs attention' })).toBeTruthy();
    type(card(3).getByLabelText('Question'), 'C?');
    expect(toolbar().queryByRole('button', { name: /need/ })).toBeNull();
  });

  it('the card header is the grip, the title, Preview and ⋯; the grip is an icon', async () => {
    await seed([q('a')]);
    await renderEditor();
    const header = card(1).getByRole('heading', { name: 'Question 1' }).parentElement!;
    expect(
      within(header)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Drag to reorder question 1', 'Preview question 1', 'More actions for question 1']);
    const grip = card(1).getByRole('button', { name: 'Drag to reorder question 1' });
    expect(grip.textContent).toBe('');
    expect(grip.querySelector('svg')).not.toBeNull();
    expect(grip.className).toContain('min-w-11');
  });

  it('a menu of the card deletes it only after Confirm delete, and Cancel keeps it', async () => {
    await seed([q('a'), q('b')]);
    await renderEditor();
    choose(2, 'Delete');
    choose(2, 'Cancel');
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(2);
    choose(2, 'Delete');
    choose(2, 'Confirm delete');
    expect(screen.getAllByRole('listitem', { name: /^Question \d+$/ })).toHaveLength(1);
    expect(outline().getAllByRole('button')).toHaveLength(1);
  });
});

describe('Set editor images', () => {
  const SHRUNK = 'shrunk webp bytes';
  beforeEach(() => {
    vi.mocked(shrinkImage).mockImplementation(async (file) =>
      file.type === 'image/png'
        ? { ok: true, blob: new NodeBlob([SHRUNK], { type: 'image/webp' }) }
        : { ok: false, error: IMAGE_TOO_LARGE },
    );
    // jsdom has no object URLs; the thumbnail only needs one to exist.
    Object.assign(URL, { createObjectURL: () => 'blob:thumbnail', revokeObjectURL: () => {} });
  });

  const png = () => new File(['big png bytes'], 'photo.png', { type: 'image/png' });

  async function savedQuestion(index = 0) {
    await settle();
    return (await getSet('set-1'))!.questions[index]!;
  }

  async function expectStoredImage(imageId: string | undefined) {
    const stored = await db.images.get(imageId!);
    expect(await stored!.blob.text()).toBe(SHRUNK);
    expect(stored!.blob.type).toBe('image/webp');
  }

  it('Add image picks a file: the shrunk image is stored and the card shows its thumbnail', async () => {
    await seed([q('a')]);
    await renderEditor();
    fireEvent.change(card(1).getByLabelText('Choose an image for question 1'), {
      target: { files: [png()] },
    });
    const thumbnail = await card(1).findByRole('img', { name: 'Image for question 1' });
    expect(thumbnail.getAttribute('src')).toBe('blob:thumbnail');
    expect(card(1).getByRole('button', { name: 'Remove image from question 1' })).toBeTruthy();
    await expectStoredImage((await savedQuestion()).imageId);
  });

  it('an image file dropped on the card becomes its image', async () => {
    await seed([q('a')]);
    await renderEditor();
    const dataTransfer = { files: [png()], types: ['Files'], dropEffect: 'none' };
    const target = screen.getByRole('listitem', { name: 'Question 1' });
    fireEvent.dragOver(target, { dataTransfer });
    // EDT-09: the card says it will take the file while one is over it.
    expect(card(1).getByText('Drop image for Question 1')).toBeTruthy();
    fireEvent.drop(target, { dataTransfer });
    expect(card(1).queryByText('Drop image for Question 1')).toBeNull();
    await card(1).findByRole('img', { name: 'Image for question 1' });
    await expectStoredImage((await savedQuestion()).imageId);
  });

  it('an image pasted into the card becomes its image; text pasted into a field stays text', async () => {
    await seed([q('a')]);
    await renderEditor();
    const answer = card(1).getByLabelText('Answer');
    // An office app puts text and a picture of it on the clipboard: the field gets the text.
    const officeCopy = fireEvent.paste(answer, {
      clipboardData: { files: [png()], types: ['text/plain', 'Files'] },
    });
    expect(officeCopy).toBe(true);
    expect(shrinkImage).not.toHaveBeenCalled();

    const imagePaste = fireEvent.paste(answer, {
      clipboardData: { files: [png()], types: ['Files'] },
    });
    expect(imagePaste).toBe(false);
    await card(1).findByRole('img', { name: 'Image for question 1' });
    await expectStoredImage((await savedQuestion()).imageId);
  });

  it('a refused image shows the reason and changes nothing', async () => {
    await seed([q('a')]);
    await renderEditor();
    const imagesBefore = await db.images.count();
    fireEvent.change(card(1).getByLabelText('Choose an image for question 1'), {
      target: { files: [new File(['x'], 'huge.gif', { type: 'image/gif' })] },
    });
    expect((await card(1).findByRole('alert')).textContent).toBe(IMAGE_TOO_LARGE);
    expect(await savedQuestion()).not.toHaveProperty('imageId');
    expect(await db.images.count()).toBe(imagesBefore);
  });

  it('a question with only an image needs no text', async () => {
    await seed([q('a', { text: '' })]);
    await renderEditor();
    fireEvent.blur(card(1).getByLabelText('Question'));
    expect(card(1).getByText('Write the question, or add an image.')).toBeTruthy();
    fireEvent.change(card(1).getByLabelText('Choose an image for question 1'), {
      target: { files: [png()] },
    });
    await card(1).findByRole('img', { name: 'Image for question 1' });
    expect(card(1).queryByText('Write the question, or add an image.')).toBeNull();
  });

  it('Remove clears the image from the question and deletes it from this browser once saved', async () => {
    await db.images.add({ id: 'img-a', blob: new Blob(['old']) });
    await seed([q('a', { imageId: 'img-a' })]);
    await renderEditor();
    fireEvent.click(card(1).getByRole('button', { name: 'Remove image from question 1' }));
    expect(card(1).getByRole('button', { name: 'Add image' })).toBeTruthy();
    // Until the set without it is saved, the stored set still points at the image.
    expect(await db.images.get('img-a')).toBeDefined();
    expect(await savedQuestion()).not.toHaveProperty('imageId');
    expect(await db.images.get('img-a')).toBeUndefined();
  });

  it('Delete question reads as destructive before it is armed (FND-07)', async () => {
    await seed([q('a')]);
    await renderEditor();
    expect(menuItem(1, 'Delete').className).toContain('text-buzz');
    expect(menuItem(1, 'Duplicate').className).not.toContain('text-buzz');
    // Delete is the menu's last item (FND-07).
    expect(card(1).getAllByRole('menuitem').at(-1)!.textContent).toBe('Delete');
  });

  it('deleting a question deletes its image, but not while a duplicate still shows it', async () => {
    await db.images.add({ id: 'img-a', blob: new Blob(['old']) });
    await seed([q('a', { imageId: 'img-a' })]);
    await renderEditor();
    choose(1, 'Duplicate');
    choose(1, 'Delete');
    choose(1, 'Confirm delete');
    expect((await savedQuestion()).imageId).toBe('img-a');
    expect(await db.images.get('img-a')).toBeDefined();

    choose(1, 'Delete');
    choose(1, 'Confirm delete');
    await settle();
    expect((await getSet('set-1'))!.questions).toEqual([]);
    expect(await db.images.get('img-a')).toBeUndefined();
  });
});

describe('Set editor choice questions', () => {
  const saved = async () => (await getSet('set-1'))!.questions[0]!;
  const choiceInput = (letter: string) => card(1).getByLabelText(`Choice ${letter}`);
  const radio = (letter: string) =>
    card(1).getByRole('radio', { name: `Choice ${letter} is correct` }) as HTMLInputElement;
  const pick = (mode: string) =>
    fireEvent.change(card(1).getByLabelText('Mode'), { target: { value: mode } });

  it('each card has a mode select, Buzz by default, with Answer for a buzz question', async () => {
    await seed([q('a')]);
    await renderEditor();
    const mode = card(1).getByLabelText('Mode') as HTMLSelectElement;
    expect(mode.value).toBe('buzz');
    expect([...mode.options].map((o) => o.textContent)).toEqual(['Buzz', 'Choice', 'Typed']);
    expect(card(1).getByLabelText('Answer')).toBeTruthy();
    expect(card(1).queryByRole('group', { name: 'Choices' })).toBeNull();
  });

  it('Choice swaps Answer for choices A and B, the answer becoming A and marked correct', async () => {
    await seed([q('a', { answer: 'Paris' })]);
    await renderEditor();
    pick('choice');
    expect(card(1).queryByLabelText('Answer')).toBeNull();
    expect(card(1).getByRole('group', { name: 'Choices' })).toBeTruthy();
    expect((choiceInput('A') as HTMLInputElement).value).toBe('Paris');
    expect((choiceInput('B') as HTMLInputElement).value).toBe('');
    expect((choiceInput('A') as HTMLInputElement).maxLength).toBe(CHOICE_TEXT_MAX);
    expect(radio('A').checked).toBe(true);
    await settle();
    expect(await saved()).toMatchObject({
      mode: 'choice',
      choices: ['Paris', ''],
      correctChoice: 0,
      answer: 'Paris',
    });
  });

  it('typing choices and marking another correct saves the answer as that choice', async () => {
    await seed([
      q('a', { mode: 'choice', choices: ['Lyon', ''], correctChoice: 0, answer: 'Lyon' }),
    ]);
    await renderEditor();
    type(choiceInput('B'), 'Paris');
    fireEvent.click(radio('B'));
    expect(radio('A').checked).toBe(false);
    await settle();
    expect(await saved()).toMatchObject({
      choices: ['Lyon', 'Paris'],
      correctChoice: 1,
      answer: 'Paris',
    });
  });

  it('adds choices up to D and removes them down to two', async () => {
    await seed([q('a', { mode: 'choice', choices: ['A1', 'B1'], correctChoice: 1, answer: 'B1' })]);
    await renderEditor();
    expect(card(1).queryByRole('button', { name: /^Remove choice/ })).toBeNull();
    fireEvent.click(card(1).getByRole('button', { name: 'Add choice' }));
    fireEvent.click(card(1).getByRole('button', { name: 'Add choice' }));
    expect(choiceInput('D')).toBeTruthy();
    expect(card(1).queryByRole('button', { name: 'Add choice' })).toBeNull();

    // EDT-06: Remove is a × icon button, and each radio sits in a label with its letter.
    expect(card(1).getByRole('button', { name: 'Remove choice A' }).textContent).toBe('');
    expect(radio('B').closest('label')!.textContent).toContain('B');
    fireEvent.click(card(1).getByRole('button', { name: 'Remove choice A' }));
    expect(radio('A').checked).toBe(true);
    await settle();
    expect(await saved()).toMatchObject({
      choices: ['B1', '', ''],
      correctChoice: 0,
      answer: 'B1',
    });
  });

  it('removing the correct choice asks the host to pick one again', async () => {
    await seed([
      q('a', {
        mode: 'choice',
        choices: ['Lyon', 'Paris', 'Nice'],
        correctChoice: 1,
        answer: 'Paris',
      }),
    ]);
    await renderEditor();
    fireEvent.click(card(1).getByRole('button', { name: 'Remove choice B' }));
    expect(card(1).getByText('Pick the correct choice.')).toBeTruthy();
    expect(radio('A').checked || radio('B').checked).toBe(false);
    fireEvent.click(radio('B'));
    expect(card(1).queryByText('Pick the correct choice.')).toBeNull();
    await settle();
    expect(await saved()).toMatchObject({
      choices: ['Lyon', 'Nice'],
      correctChoice: 1,
      answer: 'Nice',
    });
  });

  it('a blank choice shows its error once left', async () => {
    await seed([
      q('a', { mode: 'choice', choices: ['Lyon', 'Paris'], correctChoice: 1, answer: 'Paris' }),
    ]);
    await renderEditor();
    const a = choiceInput('A');
    type(a, ' ');
    expect(card(1).queryByText('Write choice A.')).toBeNull();
    fireEvent.blur(a);
    expect(card(1).getByText('Write choice A.')).toBeTruthy();
    expect(a.getAttribute('aria-invalid')).toBe('true');
  });

  it('back to Buzz shows Answer with the correct choice, and Choice brings the choices back', async () => {
    await seed([
      q('a', {
        mode: 'choice',
        choices: ['Lyon', 'Paris', 'Nice'],
        correctChoice: 1,
        answer: 'Paris',
      }),
    ]);
    await renderEditor();
    pick('buzz');
    expect((card(1).getByLabelText('Answer') as HTMLInputElement).value).toBe('Paris');
    await settle();
    expect(await saved()).not.toHaveProperty('mode');
    pick('choice');
    expect((choiceInput('C') as HTMLInputElement).value).toBe('Nice');
    expect(radio('B').checked).toBe(true);
  });
});

describe('Set editor typed questions (F87)', () => {
  const saved = async () => (await getSet('set-1'))!.questions[0]!;
  const pick = (mode: string) =>
    fireEvent.change(card(1).getByLabelText('Mode'), { target: { value: mode } });

  it('Typed keeps the answer and turns the host notes into alternatives, one per line', async () => {
    await seed([q('a', { answer: 'Beyoncé', hostNotes: 'Queen B' })]);
    await renderEditor();
    pick('typed');
    expect((card(1).getByLabelText('Answer') as HTMLInputElement).value).toBe('Beyoncé');
    const notes = card(1).getByLabelText('Other accepted answers (optional)');
    expect((notes as HTMLTextAreaElement).value).toBe('Queen B');
    expect(card(1).getByText(/One per line/)).toBeTruthy();
    expect(card(1).queryByLabelText('Host notes (optional)')).toBeNull();
    type(notes, 'Queen B\nSasha Fierce');
    await settle();
    expect(await saved()).toMatchObject({
      mode: 'typed',
      answer: 'Beyoncé',
      hostNotes: 'Queen B\nSasha Fierce',
    });
  });

  it('a typed question still needs its answer', async () => {
    await seed([q('a', { mode: 'typed', answer: '' })]);
    await renderEditor();
    const answer = card(1).getByLabelText('Answer');
    fireEvent.blur(answer);
    expect(card(1).getByText('The answer is required.')).toBeTruthy();
  });

  it('back to Buzz labels the notes as host notes again', async () => {
    await seed([q('a', { mode: 'typed', answer: 'Lyon', hostNotes: 'Lugdunum' })]);
    await renderEditor();
    expect((card(1).getByLabelText('Mode') as HTMLSelectElement).value).toBe('typed');
    pick('buzz');
    expect(card(1).getByLabelText('Host notes (optional)')).toBeTruthy();
    await settle();
    expect(await saved()).not.toHaveProperty('mode');
  });
});
