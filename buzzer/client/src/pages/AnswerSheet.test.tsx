// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../../../shared/types.js';
import { db } from '../lib/db.js';
import { AnswerSheet } from './AnswerSheet.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.sets.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function seed(questions: Question[]) {
  await db.sets.add({
    id: 'set-1',
    title: 'Pub quiz',
    questions,
    createdAt: 1,
    updatedAt: 2,
    schemaVersion: 1,
  });
}

function renderSheet(id = 'set-1') {
  return render(
    <MemoryRouter initialEntries={[`/sets/${id}/print`]}>
      <Routes>
        <Route path="/sets/:setId/print" element={<AnswerSheet />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

describe('Print answer sheet /sets/:setId/print', () => {
  it('lists number, question, answer and notes for every question, in set order', async () => {
    await seed([
      { id: 'a', text: 'Capital of France?', answer: 'Paris', hostNotes: 'Not Lyon', points: 100 },
      { id: 'b', text: 'Largest planet?', answer: 'Jupiter', points: 200 },
    ]);
    renderSheet();
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Pub quiz');
    expect(screen.getByText('2 questions')).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(cells)).toEqual([
      ['1', 'Capital of France?', 'Paris', 'Not Lyon'],
      ['2', 'Largest planet?', 'Jupiter', ''],
    ]);
  });

  it('marks a picture-only question, whose text is empty', async () => {
    await seed([{ id: 'a', text: '', imageId: 'img', answer: 'Eiffel Tower', points: 100 }]);
    renderSheet();
    const row = (await screen.findAllByRole('row'))[1]!;
    expect(cells(row)).toEqual(['1', '(picture question)', 'Eiffel Tower', '']);
  });

  it('Print opens the browser print dialog, and the controls stay off the paper', async () => {
    await seed([{ id: 'a', text: 'Q', answer: 'A', points: 100 }]);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderSheet();
    const button = await screen.findByRole('button', { name: 'Print' });
    fireEvent.click(button);
    expect(print).toHaveBeenCalledOnce();
    expect(button.parentElement!.className).toContain('print:hidden');
  });

  it('names the printout after the set, and restores the title on leaving', async () => {
    document.title = 'Buzzr';
    await seed([]);
    const view = renderSheet();
    await screen.findByText('This set has no questions yet.');
    expect(document.title).toBe('Pub quiz – answer sheet');
    view.unmount();
    expect(document.title).toBe('Buzzr');
  });

  it('says so when the set no longer exists', async () => {
    renderSheet('gone');
    expect((await screen.findByRole('alert')).textContent).toBe('This set no longer exists.');
  });
});
