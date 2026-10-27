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
import { IMPORT_FILE_MAX_BYTES } from '../lib/importExport.js';
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

  describe('Import and export JSON', () => {
    /** Captures what Export JSON downloads: the file name and its text. */
    function captureDownloads() {
      const downloads: { name: string; text: Promise<string> }[] = [];
      const blobs = new Map<string, Blob>();
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: (blob: Blob) => {
          const url = `blob:test/${blobs.size}`;
          blobs.set(url, blob);
          return url;
        },
        revokeObjectURL: vi.fn(),
      });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push({ name: this.download, text: blobs.get(this.href)!.text() });
      });
      return downloads;
    }

    function chooseFile(text: string, name = 'quiz.json', size?: number) {
      const file = new File([text], name, { type: 'application/json' });
      if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
      fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
    }

    it('Export JSON downloads the set as one named file', async () => {
      const downloads = captureDownloads();
      renderSets();
      fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: 'Export JSON' }));
      await waitFor(() => expect(downloads).toHaveLength(1));

      expect(downloads[0]!.name).toBe('sample-general-knowledge.json');
      const file = JSON.parse(await downloads[0]!.text) as QuestionSet & { images: object };
      expect(file.title).toBe(SAMPLE_SET.title);
      expect(file.questions).toEqual(SAMPLE_SET.questions);
      expect(file.images).toEqual({});
    });

    it('Export JSON on an unfinished draft says what to fix and downloads nothing', async () => {
      const downloads = captureDownloads();
      await db.sets.add(draft('d', 'Draft', []));
      renderSets();
      fireEvent.click((await card('Draft')).getByRole('button', { name: 'Export JSON' }));
      expect((await screen.findByRole('alert')).textContent).toBe('This set has no questions yet.');
      expect(downloads).toEqual([]);
    });

    it('Import JSON adds the set from a valid file', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      chooseFile(JSON.stringify({ ...SAMPLE_SET, title: 'Imported quiz' }));

      expect(await screen.findByRole('listitem', { name: 'Imported quiz' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Imported “Imported quiz”.');
      expect(await listSets()).toHaveLength(2);
    });

    it('Import JSON lists the readable errors of a bad file and adds nothing', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const broken = {
        ...SAMPLE_SET,
        title: '',
        questions: [{ ...SAMPLE_SET.questions[0], points: -1 }],
      };
      chooseFile(JSON.stringify(broken), 'broken.json');

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText("Couldn't import broken.json:")).toBeTruthy();
      expect(
        within(alert)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual([
        'Title: Too small: expected string to have >=1 characters',
        'Question 1 › points: Too small: expected number to be >=0',
      ]);
      expect(await listSets()).toHaveLength(1);
    });

    it('Import JSON refuses a file too large to be a set, without reading it', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      chooseFile(JSON.stringify(SAMPLE_SET), 'huge.json', IMPORT_FILE_MAX_BYTES + 1);

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByRole('listitem').textContent).toBe(
        'The file is larger than 201 MB.',
      );
      expect(await listSets()).toHaveLength(1);
    });
  });
});
