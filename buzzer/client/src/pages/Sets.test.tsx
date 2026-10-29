// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, getSet, listSets, NEW_SET_TITLE } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { IMPORT_FILE_MAX_BYTES } from '../lib/importExport.js';
import { sampleImages } from '../lib/sampleImages.js';
import { formatEdited } from '../lib/setLabels.js';
import { NodeBlob } from '../test/nodeBlob.js';
import { buttonsWithoutHover } from '../test/hover.js';
import { Sets } from './Sets.js';

const FIRST_VISIT = 1_700_000_000_000;
const hostToken = 'h'.repeat(43);

/** The host's own set: a copy of the sample, with its two pictures, saved in this browser. */
const OWN: QuestionSet = {
  ...SAMPLE_SET,
  id: 'own-quiz',
  title: 'Pub quiz',
  createdAt: FIRST_VISIT,
  updatedAt: FIRST_VISIT,
};

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  // Stored pictures must survive fake-indexeddb's clone (see nodeBlob.ts).
  vi.stubGlobal('Blob', NodeBlob);
  await db.delete();
  await db.open();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function addOwn() {
  await db.sets.add(OWN);
  await db.images.bulkAdd(sampleImages());
}

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

const tab = (name: string) => screen.getByRole('tab', { name });
const selectedTab = async () =>
  (await screen.findAllByRole('tab')).find((t) => t.getAttribute('aria-selected') === 'true')!
    .textContent;
const cardTitles = () =>
  screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

function draft(id: string, title: string, questions: QuestionSet['questions']): QuestionSet {
  return { id, title, questions, createdAt: 1, updatedAt: 2, schemaVersion: 1 };
}

/** A fake server that creates room WXYZ and accepts every image upload. */
function stubServer() {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      url === '/api/rooms'
        ? Response.json({ code: 'WXYZ', hostToken }, { status: 201 })
        : Response.json({ ok: true }, { status: 201 }),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const bodyOf = (fetch: ReturnType<typeof stubServer>, call = 0) =>
  JSON.parse((fetch.mock.calls[call] as unknown as [string, RequestInit])[1].body as string) as {
    set: QuestionSet;
    settings: unknown;
  };

describe('Set list tabs', () => {
  it('opens on Built-in when My sets is empty, listing the sample then the 60 starters', async () => {
    renderSets();
    expect(await selectedTab()).toBe('Built-in');
    await card(SAMPLE_SET.title);
    expect(cardTitles()).toEqual(BUILT_IN_SETS.map((s) => s.title));
    expect(cardTitles()).toHaveLength(61);
    expect(screen.getByRole('tabpanel', { name: 'Built-in' })).toBeTruthy();
  });

  it('opens on My sets once this browser has a set', async () => {
    await addOwn();
    renderSets();
    expect(await selectedTab()).toBe('My sets');
    await card(OWN.title);
    expect(cardTitles()).toEqual([OWN.title]);
  });

  it('switches tabs on click and with the arrow keys', async () => {
    await addOwn();
    renderSets();
    await card(OWN.title);
    fireEvent.click(tab('Built-in'));
    await card(SAMPLE_SET.title);
    expect(screen.queryByRole('listitem', { name: OWN.title })).toBeNull();

    fireEvent.keyDown(tab('Built-in'), { key: 'ArrowRight' });
    expect(await selectedTab()).toBe('My sets');
    expect(document.activeElement).toBe(tab('My sets'));
    await card(OWN.title);
    fireEvent.keyDown(tab('My sets'), { key: 'ArrowLeft' });
    expect(await selectedTab()).toBe('Built-in');
  });

  it('a built-in card offers only Duplicate to My sets, Host this set and Preview', async () => {
    renderSets();
    const starter = await card(STARTER_SETS[0]!.title);
    expect(starter.getByText('15 questions · Easy')).toBeTruthy();
    expect(
      starter
        .getAllByRole('button')
        .concat(starter.queryAllByRole('link'))
        .map((b) => b.textContent),
    ).toEqual(['Duplicate to My sets', 'Host this set', 'Preview']);
  });

  it('groups the built-in cards under category headings, the sample under Other', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Other', ...new Set(STARTER_SETS.map((s) => s.category!))]);
    const animals = within(screen.getByRole('region', { name: 'Animals' }));
    expect(animals.getAllByRole('listitem')).toHaveLength(3);
  });

  it('search and the Easy chip narrow the built-ins to Animals – Easy', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'animal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    expect(cardTitles()).toEqual(['Animals – Easy']);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('Duplicate to My sets');
  });

  it('Duplicate to My sets saves an editable copy and shows it in My sets', async () => {
    renderSets();
    fireEvent.click(
      (await card(STARTER_SETS[1]!.title)).getByRole('button', { name: 'Duplicate to My sets' }),
    );
    const copy = await card(`${STARTER_SETS[1]!.title} (copy)`);
    expect(await selectedTab()).toBe('My sets');
    expect(screen.getByRole('status').textContent).toBe(
      `Copied “${STARTER_SETS[1]!.title} (copy)” to My sets.`,
    );
    expect(copy.getByRole('link', { name: 'Open' })).toBeTruthy();
    const [stored] = await listSets();
    expect(stored).toMatchObject({ questions: STARTER_SETS[1]!.questions, createdAt: FIRST_VISIT });
    expect(stored!.id).not.toBe(STARTER_SETS[1]!.id);
  });

  it('Host this set on the built-in sample creates a room and uploads its 2 pictures', async () => {
    const fetch = stubServer();
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: 'Host this set' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(bodyOf(fetch)).toEqual({ set: SAMPLE_SET, settings: DEFAULT_SETTINGS });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/rooms',
      '/api/rooms/WXYZ/images/sample-img-hexagon',
      '/api/rooms/WXYZ/images/sample-img-flag',
    ]);
    expect(await listSets()).toEqual([]);
  });

  it('Host this set on a starter creates a room with its questions and level points', async () => {
    const fetch = stubServer();
    const hard = STARTER_SETS[2]!;
    renderSets();
    fireEvent.click((await card(hard.title)).getByRole('button', { name: 'Host this set' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    const { set } = bodyOf(fetch);
    expect(set).toEqual(hard);
    expect(new Set(set.questions.map((q) => q.points))).toEqual(new Set([300]));
  });

  it('Preview of the built-in sample shows its answers and its pictures from the bundle', async () => {
    Object.assign(URL, { createObjectURL: () => 'blob:sample', revokeObjectURL: () => {} });
    renderSets();
    fireEvent.click(
      (await card(SAMPLE_SET.title)).getByRole('button', { name: `Preview ${SAMPLE_SET.title}` }),
    );
    const preview = within(screen.getByRole('dialog', { name: SAMPLE_SET.title }));
    expect(preview.getAllByRole('listitem')).toHaveLength(SAMPLE_SET.questions.length);
    expect(preview.getByText(SAMPLE_SET.questions[0]!.answer)).toBeTruthy();
    expect(await preview.findAllByRole('img', { name: /^Picture for question/ })).toHaveLength(2);
  });

  it('Host this set in a preview creates a room with that set', async () => {
    const fetch = stubServer();
    const hard = STARTER_SETS[2]!;
    renderSets();
    fireEvent.click(
      (await card(hard.title)).getByRole('button', { name: `Preview ${hard.title}` }),
    );
    const preview = within(screen.getByRole('dialog', { name: hard.title }));
    fireEvent.click(preview.getByRole('button', { name: 'Host this set' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(bodyOf(fetch).set).toEqual(hard);
  });

  it('every button on the Built-in tab has the hover style', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    expect(buttonsWithoutHover()).toEqual([]);
  });
});

describe('Set list /sets, My sets', () => {
  it('shows a card with title, question count and last edited time', async () => {
    await addOwn();
    renderSets();
    const own = await card(OWN.title);
    expect(own.getByText(/^10 questions · Last edited/)).toBeTruthy();
    expect(own.getByText(formatEdited(FIRST_VISIT))).toBeTruthy();
  });

  it('lists every saved set, last edited first', async () => {
    await addOwn();
    await db.sets.add({ ...draft('newer', 'Newer quiz', []), updatedAt: FIRST_VISIT + 1 });
    renderSets();
    await card('Newer quiz');
    expect(cardTitles()).toEqual(['Newer quiz', OWN.title]);
  });

  it('each tab starts with a clear search and no chip on', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'animal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Easy' }));
    fireEvent.click(
      (await card('Animals – Easy')).getByRole('button', { name: 'Duplicate to My sets' }),
    );
    await card('Animals – Easy (copy)');
    expect(await selectedTab()).toBe('My sets');
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
    expect(screen.getByRole('button', { name: 'Easy' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('search finds my sets by title, and Enter focuses Open on the one left', async () => {
    await addOwn();
    await db.sets.add({ ...draft('newer', 'Newer quiz', []), updatedAt: FIRST_VISIT + 1 });
    renderSets();
    await card('Newer quiz');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'pub' },
    });
    expect(cardTitles()).toEqual([OWN.title]);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('Open');
  });

  it("Preview on My sets shows the set's answers and its pictures from this browser", async () => {
    Object.assign(URL, { createObjectURL: () => 'blob:own', revokeObjectURL: () => {} });
    await addOwn();
    // A picture gone from this browser is named, not shown.
    await db.images.delete(SAMPLE_SET.questions.find((q) => q.imageId)!.imageId!);
    renderSets();
    fireEvent.click((await card('Pub quiz')).getByRole('button', { name: 'Preview Pub quiz' }));
    const preview = within(screen.getByRole('dialog', { name: 'Pub quiz' }));
    expect(preview.getAllByRole('listitem')).toHaveLength(OWN.questions.length);
    expect(preview.getByText(OWN.questions[0]!.answer)).toBeTruthy();
    expect(await preview.findAllByRole('img', { name: /^Picture for question/ })).toHaveLength(1);
    expect(await preview.findByText('The picture is missing from this browser.')).toBeTruthy();
  });

  it('shows the empty state when no sets exist', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    fireEvent.click(tab('My sets'));
    expect(await screen.findByText(/No question sets yet/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('Open goes to the set editor', async () => {
    await addOwn();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('link', { name: 'Open' }));
    expect(screen.getByTestId('path').textContent).toBe(`/sets/${OWN.id}`);
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
    await addOwn();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: 'Duplicate' }));
    const copy = await card(`${OWN.title} (copy)`);
    expect(copy.getByText(/^10 questions/)).toBeTruthy();
    expect(await listSets()).toHaveLength(2);
  });

  it('Delete asks for confirmation, and Cancel keeps the set', async () => {
    await addOwn();
    renderSets();
    const own = await card(OWN.title);
    fireEvent.click(own.getByRole('button', { name: 'Delete' }));
    fireEvent.click(own.getByRole('button', { name: 'Cancel' }));
    expect(await getSet(OWN.id)).toBeDefined();
    expect(own.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('Delete then Confirm delete removes the set', async () => {
    await addOwn();
    renderSets();
    const own = await card(OWN.title);
    fireEvent.click(own.getByRole('button', { name: 'Delete' }));
    fireEvent.click(own.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: OWN.title })).toBeNull());
    expect(await getSet(OWN.id)).toBeUndefined();
    expect(await listSets()).toHaveLength(0);
  });

  it('Host this set creates a room with that set and offers the Screen choices', async () => {
    await addOwn();
    const fetch = stubServer();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: 'Host this set' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(screen.getByText('WXYZ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this device as the Screen' })).toBeTruthy();
    expect(loadHostToken('WXYZ')).toBe(hostToken);
    expect(bodyOf(fetch)).toEqual({ set: OWN, settings: DEFAULT_SETTINGS });
  });

  it('Host this set offers Use this phone as the host remote, which opens /host/<CODE>', async () => {
    await addOwn();
    stubServer();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: 'Host this set' }));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Use this phone as the host remote' }),
    );
    expect(screen.getByTestId('path').textContent).toBe('/host/WXYZ');
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('every button on the list and on Room created has the hover style', async () => {
    await addOwn();
    stubServer();
    renderSets();
    const own = await card(OWN.title);
    expect(buttonsWithoutHover()).toEqual([]);
    fireEvent.click(own.getByRole('button', { name: 'Host this set' }));
    await screen.findByRole('heading', { name: 'Room created' });
    expect(buttonsWithoutHover()).toEqual([]);
  });

  it('Host this set shows the server refusal and keeps the list', async () => {
    await addOwn();
    vi.stubGlobal('fetch', () =>
      Promise.resolve(Response.json({ ok: false, error: 'Too many rooms' }, { status: 429 })),
    );
    renderSets();
    const own = await card(OWN.title);
    fireEvent.click(own.getByRole('button', { name: 'Host this set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many rooms');
    expect(screen.queryByRole('heading', { name: 'Room created' })).toBeNull();
    expect(localStorage.length).toBe(0);
    await waitFor(() =>
      expect(own.getByRole('button', { name: 'Host this set' })).toHaveProperty('disabled', false),
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
      await addOwn();
      renderSets();
      fireEvent.click((await card(OWN.title)).getByRole('button', { name: 'Export JSON' }));
      await waitFor(() => expect(downloads).toHaveLength(1));

      expect(downloads[0]!.name).toBe('pub-quiz.json');
      const file = JSON.parse(await downloads[0]!.text) as QuestionSet & { images: object };
      expect(file.title).toBe(OWN.title);
      expect(file.questions).toEqual(SAMPLE_SET.questions);
      expect(Object.keys(file.images).sort()).toEqual(['sample-img-flag', 'sample-img-hexagon']);
      expect(Object.values(file.images)).toEqual([
        expect.stringMatching(/^data:image\/png;base64,iVBORw0KGgo/),
        expect.stringMatching(/^data:image\/png;base64,iVBORw0KGgo/),
      ]);
    });

    it('Export JSON on an unfinished draft says what to fix and downloads nothing', async () => {
      const downloads = captureDownloads();
      await db.sets.add(draft('d', 'Draft', []));
      renderSets();
      fireEvent.click((await card('Draft')).getByRole('button', { name: 'Export JSON' }));
      expect((await screen.findByRole('alert')).textContent).toBe('This set has no questions yet.');
      expect(downloads).toEqual([]);
    });

    it('Import JSON adds the set from a valid file and shows My sets', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const textOnly = SAMPLE_SET.questions.filter((q) => q.imageId === undefined);
      chooseFile(JSON.stringify({ ...SAMPLE_SET, title: 'Imported quiz', questions: textOnly }));

      expect(await screen.findByRole('listitem', { name: 'Imported quiz' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Imported “Imported quiz”.');
      expect(await selectedTab()).toBe('My sets');
      expect(await listSets()).toHaveLength(1);
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
      expect(await listSets()).toHaveLength(0);
    });

    it('Import JSON refuses a file too large to be a set, without reading it', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      chooseFile(JSON.stringify(SAMPLE_SET), 'huge.json', IMPORT_FILE_MAX_BYTES + 1);

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByRole('listitem').textContent).toBe(
        'The file is larger than 201 MB.',
      );
      expect(await listSets()).toHaveLength(0);
    });
  });
});

describe('Set list /sets, Build a game', () => {
  const change = (name: string, value: string) =>
    fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

  /** Opens the builder once the sets have loaded (it is disabled until then). */
  async function openBuilder() {
    await screen.findAllByRole('tab');
    fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
  }

  it('builds a game from the sample and hosts it with its pictures, saving nothing', async () => {
    const fetch = stubServer();
    renderSets();
    await openBuilder();
    expect(screen.getByRole('heading', { name: 'Build a game' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    change('Category, row 1', 'Other');
    change('Questions, row 1', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Host this game' }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(bodyOf(fetch).set).toMatchObject({ title: 'Mixed: Other', category: 'Mixed' });
    expect(bodyOf(fetch).set.questions).toHaveLength(10);
    expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
      '/api/rooms',
      '/api/rooms/WXYZ/images/sample-img-flag',
      '/api/rooms/WXYZ/images/sample-img-hexagon',
    ]);
    expect(await listSets()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Back to question sets' }));
    expect(await screen.findByRole('tablist')).toBeTruthy();
  });

  it('draws from my own sets as well as the built-ins', async () => {
    await addOwn();
    renderSets();
    await openBuilder();
    change('Category, row 1', 'Other');
    change('Questions, row 1', '15');
    // Pub quiz is a copy of the sample: its questions count once.
    expect(screen.getByText('Total: 10 questions')).toBeTruthy();
  });

  it('Save to My sets shows the game in My sets', async () => {
    renderSets();
    await openBuilder();
    change('Questions, row 1', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Save to My sets' }));

    expect(await screen.findByText('Saved “Mixed: Animals” to My sets.')).toBeTruthy();
    expect(await selectedTab()).toBe('My sets');
    expect((await card('Mixed: Animals')).getByText(/^4 questions/)).toBeTruthy();
  });
});
