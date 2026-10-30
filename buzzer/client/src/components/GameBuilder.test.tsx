// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, getImage, listSets } from '../lib/db.js';
import { BOARD_SIZE_MESSAGE, GAME_LIMIT_MESSAGE } from '../lib/gameBuilder.js';
import { checkPlayable } from '../lib/hostRoom.js';
import { NodeBlob } from '../test/nodeBlob.js';
import { GameBuilder, type BuiltGame } from './GameBuilder.js';

const NOW = 1_700_000_000_000;

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  // Stored pictures must survive fake-indexeddb's clone (see nodeBlob.ts).
  vi.stubGlobal('Blob', NodeBlob);
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A repeatable [0, 1) sequence for the shuffle. */
function seeded(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function renderBuilder({
  sources = BUILT_IN_SETS,
  onHost = vi.fn<(game: BuiltGame) => Promise<void>>(async () => {}),
}: { sources?: readonly QuestionSet[]; onHost?: (game: BuiltGame) => Promise<void> } = {}) {
  const onSaved = vi.fn<(saved: QuestionSet) => void>();
  const onBack = vi.fn();
  render(
    <GameBuilder
      sources={sources}
      hostLabel="Host this game"
      hostingLabel="Creating room…"
      onHost={onHost}
      onSaved={onSaved}
      onBack={onBack}
      random={seeded()}
    />,
  );
  return { onHost, onSaved, onBack };
}

const select = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });
const choose = (name: string, value: string) =>
  fireEvent.change(select(name), { target: { value } });
const total = () => screen.getByText(/^Total:/).textContent;
const hostButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Host this game' });
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Save to My sets' });

/** Three rows: Animals, Science and World History, 3 questions each at one difficulty. */
function pickThreeByThree() {
  fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
  const rows: [string, string][] = [
    ['Animals', 'easy'],
    ['Science', 'medium'],
    ['World History', 'hard'],
  ];
  rows.forEach(([category, difficulty], i) => {
    choose(`Category, row ${i + 1}`, category);
    choose(`Difficulty, row ${i + 1}`, difficulty);
    choose(`Questions, row ${i + 1}`, '3');
  });
}

describe('GameBuilder', () => {
  it('starts with one row: the first category A–Z, any difficulty, 5 questions', () => {
    renderBuilder();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(select('Category, row 1').value).toBe('Animals');
    expect(select('Difficulty, row 1').value).toBe('any');
    expect(select('Questions, row 1').value).toBe('5');
    expect(total()).toBe('Total: 5 questions');
  });

  it('offers every category, any or one difficulty, and counts 1 to 15', () => {
    renderBuilder();
    const options = (name: string) => [...select(name).options].map((option) => option.textContent);
    expect(options('Category, row 1')).toHaveLength(21);
    expect(options('Category, row 1')).toContain('Other');
    expect(options('Difficulty, row 1')).toEqual(['Any difficulty', 'Easy', 'Medium', 'Hard']);
    expect(options('Questions, row 1')).toEqual(
      Array.from({ length: 15 }, (_, i) => String(i + 1)),
    );
  });

  it('Add a row picks the next category, the total follows every change, Remove drops a row', () => {
    renderBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    expect(select('Category, row 2').value).toBe('Anime & Manga');
    expect(total()).toBe('Total: 10 questions');
    choose('Questions, row 2', '12');
    expect(total()).toBe('Total: 17 questions');
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(select('Category, row 1').value).toBe('Anime & Manga');
    expect(total()).toBe('Total: 12 questions');
  });

  it('a row asking for more than exist says how many match, and the total counts those', () => {
    renderBuilder();
    choose('Category, row 1', 'Other');
    choose('Questions, row 1', '15');
    const row = within(screen.getByRole('listitem', { name: 'Row 1' }));
    expect(row.getByText('Only 10 questions match.')).toBeTruthy();
    expect(total()).toBe('Total: 10 questions');
    expect(hostButton().disabled).toBe(false);
  });

  it('over 100 questions says so and offers neither Host nor Save', () => {
    renderBuilder();
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    for (let i = 1; i <= 7; i++) choose(`Questions, row ${i}`, '15');
    expect(total()).toBe('Total: 105 questions');
    expect(screen.getByText(GAME_LIMIT_MESSAGE)).toBeTruthy();
    expect(hostButton().disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    choose('Questions, row 7', '10');
    expect(total()).toBe('Total: 100 questions');
    expect(hostButton().disabled).toBe(false);
  });

  it('with no rows left, there is nothing to host', () => {
    renderBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
    expect(total()).toBe('Total: 0 questions');
    expect(hostButton().disabled).toBe(true);
  });

  it('Host passes a playable Mixed set of the picks, its pictures loadable', async () => {
    const { onHost } = renderBuilder({ sources: [SAMPLE_SET, ...BUILT_IN_SETS] });
    pickThreeByThree();
    fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    choose('Category, row 4', 'Other');
    choose('Questions, row 4', '10');
    expect(total()).toBe('Total: 19 questions');
    fireEvent.click(hostButton());
    await waitFor(() => expect(onHost).toHaveBeenCalledTimes(1));

    const { set, loadImage } = vi.mocked(onHost).mock.calls[0]![0];
    expect(set.title).toBe('Mixed: Animals, Science, World History, Other');
    expect(set.category).toBe('Mixed');
    expect(set.questions).toHaveLength(19);
    expect(checkPlayable(set)).toEqual({ ok: true, set });
    // The sample's ten questions count once, though it is in the sources twice.
    expect(
      set.questions.filter((q) => SAMPLE_SET.questions.some((s) => s.text === q.text)),
    ).toHaveLength(10);
    expect(await loadImage(SAMPLE_HEXAGON_ID)).toBeTruthy();
  });

  it('shows the host error and lets the host try again', async () => {
    const onHost = vi.fn(async () => {
      throw new Error('Server busy');
    });
    renderBuilder({ onHost });
    fireEvent.click(hostButton());
    expect((await screen.findByRole('alert')).textContent).toBe('Server busy');
    expect(hostButton().disabled).toBe(false);
  });

  it('Save to My sets stores the game with its own copies of the pictures', async () => {
    const { onSaved } = renderBuilder();
    choose('Category, row 1', 'Other');
    choose('Questions, row 1', '10');
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const saved = onSaved.mock.calls[0]![0];
    expect(await listSets()).toEqual([saved]);
    expect(saved).toMatchObject({ title: 'Mixed: Other', category: 'Mixed', createdAt: NOW });
    const imageIds = saved.questions.flatMap((q) => (q.imageId ? [q.imageId] : []));
    expect(imageIds).toHaveLength(2);
    expect(imageIds).not.toContain(SAMPLE_HEXAGON_ID);
    expect(imageIds).not.toContain(SAMPLE_FLAG_ID);
    for (const id of imageIds) expect((await getImage(id))?.blob.size).toBeGreaterThan(0);
  });

  it('the kind of game is one radio group with Mixed questions picked (LND-07)', () => {
    renderBuilder();
    const group = screen.getByRole('radiogroup', { name: 'Kind of game' });
    const radios = within(group).getAllByRole<HTMLInputElement>('radio');
    expect(radios.map((r) => r.closest('label')!.textContent)).toEqual([
      'Mixed questions',
      'Category board',
    ]);
    expect(radios.map((r) => r.checked)).toEqual([true, false]);
    expect(radios.every((r) => r.name === radios[0]!.name)).toBe(true);
  });

  it('shows the host error and a problem in one place, above Host, Save and Back in one row (LND-07)', async () => {
    const onHost = vi.fn(() => Promise.reject(new Error('The server said no.')));
    renderBuilder({ onHost });
    const actions = hostButton().parentElement!;
    expect(actions.className).toContain('md:flex-row');
    expect(saveButton().parentElement).toBe(actions);
    expect(screen.getByRole('button', { name: 'Back to the sets' }).parentElement).toBe(actions);

    fireEvent.click(hostButton());
    const alert = await screen.findByRole('alert');
    expect(alert.parentElement!.nextElementSibling).toBe(actions);

    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Add a row' }));
    for (let i = 1; i <= 7; i++) choose(`Questions, row ${i}`, '15');
    expect(screen.getByText(GAME_LIMIT_MESSAGE).parentElement!.nextElementSibling).toBe(actions);
  });

  it('Back to the sets leaves the builder', () => {
    const { onBack } = renderBuilder();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the sets' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('GameBuilder: Category board mode (F90)', () => {
  const boardMode = () => fireEvent.click(screen.getByRole('radio', { name: 'Category board' }));
  const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }));
  const boxes = () => screen.getAllByRole<HTMLInputElement>('checkbox');

  it('offers only categories with an Easy, a Medium and a Hard question', () => {
    renderBuilder();
    boardMode();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Category board' }).checked).toBe(
      true,
    );
    const names = boxes().map((box) => box.closest('label')!.textContent);
    expect(names).toContain('Animals');
    // The sample set has no difficulty, so "Other" cannot fill a column.
    expect(names).not.toContain('Other');
    expect(screen.queryByRole('button', { name: 'Add a row' })).toBeNull();
  });

  it('needs 2 categories before it can host', () => {
    renderBuilder();
    boardMode();
    expect(screen.getByText(BOARD_SIZE_MESSAGE)).toBeTruthy();
    expect(hostButton().disabled).toBe(true);
    tick('Animals');
    expect(hostButton().disabled).toBe(true);
    tick('Science');
    expect(screen.queryByText(BOARD_SIZE_MESSAGE)).toBeNull();
    expect(hostButton().disabled).toBe(false);
    expect(screen.getByText('2 of 6 categories')).toBeTruthy();
  });

  it('stops at 6 categories', () => {
    renderBuilder();
    boardMode();
    for (const box of boxes().slice(0, 6)) fireEvent.click(box);
    expect(boxes().filter((box) => box.checked)).toHaveLength(6);
    expect(
      boxes()
        .filter((box) => !box.checked)
        .every((box) => box.disabled),
    ).toBe(true);
    fireEvent.click(boxes()[0]!);
    expect(boxes().every((box) => !box.disabled)).toBe(true);
  });

  it('hosts a board: a column per category in the order ticked, 100/200/300 from the starters', async () => {
    const { onHost } = renderBuilder();
    boardMode();
    tick('World History');
    tick('Animals');
    tick('Science');
    expect(screen.getByText('Column 1').closest('label')!.textContent).toContain('World History');
    fireEvent.click(hostButton());
    await waitFor(() => expect(onHost).toHaveBeenCalledTimes(1));

    const { set } = vi.mocked(onHost).mock.calls[0]![0];
    expect(set.title).toBe('Board: World History, Animals, Science');
    expect(set.board!.columns.map((c) => c.title)).toEqual(['World History', 'Animals', 'Science']);
    const points = new Map(set.questions.map((q) => [q.id, q.points]));
    for (const column of set.board!.columns) {
      expect(column.questionIds.map((id) => points.get(id))).toEqual([100, 200, 300]);
    }
    expect(checkPlayable(set)).toEqual({ ok: true, set });
  });

  it('Save to My sets keeps the board', async () => {
    const { onSaved } = renderBuilder();
    boardMode();
    tick('Animals');
    tick('Science');
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [stored] = await listSets();
    expect(stored!.board!.columns.map((c) => c.title)).toEqual(['Animals', 'Science']);
  });

  it('Mixed questions keeps its rows across a switch', () => {
    renderBuilder();
    choose('Questions, row 1', '3');
    boardMode();
    fireEvent.click(screen.getByRole('radio', { name: 'Mixed questions' }));
    expect(select('Questions, row 1').value).toBe('3');
  });

  it('says so when no category has every level', () => {
    renderBuilder({ sources: [SAMPLE_SET] });
    boardMode();
    expect(screen.getByText('No category has an Easy, a Medium and a Hard question.')).toBeTruthy();
    expect(hostButton().disabled).toBe(true);
  });
});
