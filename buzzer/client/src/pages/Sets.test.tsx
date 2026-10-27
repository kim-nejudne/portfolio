// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, deleteSet, getSet, listSets, NEW_SET_TITLE } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { formatEdited } from '../lib/setLabels.js';
import { Sets } from './Sets.js';

const FIRST_VISIT = 1_700_000_000_000;
const hostToken = 'h'.repeat(43);

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderSets() {
  render(
    <MemoryRouter initialEntries={['/sets']}>
      <Routes>
        <Route path="/sets" element={<Sets />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The card of the set titled `title`, once the list has loaded. */
async function card(title: string) {
  return within(await screen.findByRole('listitem', { name: title }));
}

function draft(id: string, title: string, questions: QuestionSet['questions']): QuestionSet {
  return { id, title, questions, createdAt: 1, updatedAt: 2, schemaVersion: 1 };
}

describe('Set list /sets', () => {
  it('shows a card with title, question count and last edited time', async () => {
    renderSets();
    const sample = await card(SAMPLE_SET.title);
    expect(sample.getByText(/^10 questions · Last edited/)).toBeTruthy();
    expect(sample.getByText(formatEdited(FIRST_VISIT))).toBeTruthy();
  });

  it('lists every saved set, last edited first', async () => {
    await db.sets.add({ ...draft('newer', 'Newer quiz', []), updatedAt: FIRST_VISIT + 1 });
    renderSets();
    await card('Newer quiz');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Newer quiz', SAMPLE_SET.title]);
  });

  it('shows the empty state when no sets exist', async () => {
    await deleteSet(SAMPLE_SET.id);
    renderSets();
    expect(await screen.findByText(/No question sets yet/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('Open goes to the set editor', async () => {
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('link', { name: 'Open' }));
    expect(screen.getByTestId('path').textContent).toBe(`/sets/${SAMPLE_SET.id}`);
  });

  it('New set saves an untitled draft and opens it in the editor', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    fireEvent.click(screen.getByRole('button', { name: 'New set' }));
    await screen.findByTestId('path');
    const created = (await listSets()).find((s) => s.title === NEW_SET_TITLE)!;
    expect(created.questions).toEqual([]);
    expect(screen.getByTestId('path').textContent).toBe(`/sets/${created.id}`);
  });

  it('Duplicate adds a copy card', async () => {
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: 'Duplicate' }));
    const copy = await card(`${SAMPLE_SET.title} (copy)`);
    expect(copy.getByText(/^10 questions/)).toBeTruthy();
    expect(await listSets()).toHaveLength(2);
  });

  it('Delete asks for confirmation, and Cancel keeps the set', async () => {
    renderSets();
    const sample = await card(SAMPLE_SET.title);
    fireEvent.click(sample.getByRole('button', { name: 'Delete' }));
    fireEvent.click(sample.getByRole('button', { name: 'Cancel' }));
    expect(await getSet(SAMPLE_SET.id)).toBeDefined();
    expect(sample.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('Delete then Confirm delete removes the set', async () => {
    renderSets();
    const sample = await card(SAMPLE_SET.title);
    fireEvent.click(sample.getByRole('button', { name: 'Delete' }));
    fireEvent.click(sample.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByText(/No question sets yet/)).toBeTruthy();
    expect(await getSet(SAMPLE_SET.id)).toBeUndefined();
  });

  it('Host this set creates a room with that set and offers the Screen choices', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(Response.json({ code: 'WXYZ', hostToken }, { status: 201 })),
    );
    vi.stubGlobal('fetch', fetch);
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: 'Host this set' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(screen.getByText('WXYZ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this device as the Screen' })).toBeTruthy();
    expect(loadHostToken('WXYZ')).toBe(hostToken);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      set: { ...SAMPLE_SET, createdAt: FIRST_VISIT, updatedAt: FIRST_VISIT },
      settings: DEFAULT_SETTINGS,
    });
  });

  it('Host this set shows the server refusal and keeps the list', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(Response.json({ ok: false, error: 'Too many rooms' }, { status: 429 })),
    );
    renderSets();
    const sample = await card(SAMPLE_SET.title);
    fireEvent.click(sample.getByRole('button', { name: 'Host this set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many rooms');
    expect(screen.queryByRole('heading', { name: 'Room created' })).toBeNull();
    expect(localStorage.length).toBe(0);
    await waitFor(() =>
      expect(sample.getByRole('button', { name: 'Host this set' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
  });

  it('Host this set on an unfinished draft says what to fix and sends nothing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await db.sets.add(
      draft('d', 'Draft', [
        { id: 'q1', text: 'What?', answer: 'Yes', points: 100 },
        { id: 'q2', text: 'Who?', answer: '', points: 100 },
      ]),
    );
    renderSets();
    fireEvent.click((await card('Draft')).getByRole('button', { name: 'Host this set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Question 2 needs an answer.');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'New set' })).toHaveProperty('disabled', false),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
