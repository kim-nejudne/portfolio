// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_QUESTIONS_PER_SET,
  QUESTION_TEXT_MAX,
  SET_CATEGORY_MAX,
} from '../../../shared/constants.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { AUTOSAVE_DELAY_MS } from '../lib/autosave.js';
import { db, getSet } from '../lib/db.js';
import { IMAGE_TOO_LARGE, shrinkImage } from '../lib/imagePipeline.js';
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
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'Save status' }).textContent).toBe('Saved'),
  );
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
    screen.getAllByRole('listitem').forEach((item, i) => {
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
    fireEvent.drop(target, { dataTransfer });
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

  it('deleting a question deletes its image, but not while a duplicate still shows it', async () => {
    await db.images.add({ id: 'img-a', blob: new Blob(['old']) });
    await seed([q('a', { imageId: 'img-a' })]);
    await renderEditor();
    fireEvent.click(card(1).getByRole('button', { name: 'Duplicate question 1' }));
    fireEvent.click(card(1).getByRole('button', { name: 'Delete question 1' }));
    fireEvent.click(card(1).getByRole('button', { name: 'Confirm delete' }));
    expect((await savedQuestion()).imageId).toBe('img-a');
    expect(await db.images.get('img-a')).toBeDefined();

    fireEvent.click(card(1).getByRole('button', { name: 'Delete question 1' }));
    fireEvent.click(card(1).getByRole('button', { name: 'Confirm delete' }));
    await settle();
    expect((await getSet('set-1'))!.questions).toEqual([]);
    expect(await db.images.get('img-a')).toBeUndefined();
  });
});
