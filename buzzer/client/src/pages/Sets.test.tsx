// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { db, getSet, listSets, NEW_SET_TITLE } from '../lib/db.js';
import { loadHostToken } from '../lib/hostTokens.js';
import { exportAllFileName, IMPORT_FILE_MAX_BYTES } from '../lib/importExport.js';
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
  // jsdom lays nothing out, so it has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
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

/** A tab by its label; its name also carries its count ("My sets 3"). */
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name} \\d+$`) });
/** The open tab's label, without its count. */
const selectedTab = async () =>
  (await screen.findAllByRole('tab'))
    .find((t) => t.getAttribute('aria-selected') === 'true')!
    .textContent.replace(/ \d+$/, '');
/** Opens the `⋯` menu of the card titled `title`, and returns the menu. */
async function openMenu(title: string) {
  fireEvent.click((await card(title)).getByRole('button', { name: `More actions for ${title}` }));
  return within(screen.getByRole('menu', { name: `More actions for ${title}` }));
}

/** Chooses `label` in the `⋯` menu of the card titled `title`. */
async function chooseInMenu(title: string, label: string) {
  fireEvent.click((await openMenu(title)).getByRole('menuitem', { name: label }));
}

/** The toast at the foot of the window: a confirmation is a status, a failure an alert. */
const toast = (role: 'status' | 'alert' = 'status') =>
  screen.findByRole(role, {}, { timeout: 2000 }).then((el) => el.textContent);

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
    expect(screen.getByRole('tabpanel', { name: 'Built-in 61' })).toBeTruthy();
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

  it('a built-in card shows Host and Preview, and its ⋯ menu only Duplicate to My sets', async () => {
    renderSets();
    const title = STARTER_SETS[0]!.title;
    const starter = await card(title);
    expect(starter.getByText('15 questions · Easy')).toBeTruthy();
    expect(
      starter.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual([title, `Host ${title}`, `Preview ${title}`, `More actions for ${title}`]);
    const menu = await openMenu(title);
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Duplicate to My sets',
    ]);
  });

  it("a built-in card's title opens its preview (LIB-02)", async () => {
    renderSets();
    const title = STARTER_SETS[0]!.title;
    fireEvent.click((await card(title)).getByRole('button', { name: title }));
    expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
  });

  it('Host is the gold primary, and the cards form a 1/2/3-column grid (LIB-01)', async () => {
    renderSets();
    const sample = await card(SAMPLE_SET.title);
    expect(sample.getByRole('button', { name: /^Host / }).className).toContain('bg-accent');
    expect(sample.getByRole('button', { name: /^Preview / }).className).not.toContain('bg-accent');
    const grid = screen.getByRole('listitem', { name: SAMPLE_SET.title }).parentElement!;
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('xl:grid-cols-3');
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
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Animals – Easy' }));
  });

  it('Duplicate to My sets saves an editable copy and shows it in My sets', async () => {
    renderSets();
    await chooseInMenu(STARTER_SETS[1]!.title, 'Duplicate to My sets');
    const copy = await card(`${STARTER_SETS[1]!.title} (copy)`);
    expect(await selectedTab()).toBe('My sets');
    expect(await toast()).toBe(`Copied “${STARTER_SETS[1]!.title} (copy)” to My sets.`);
    expect(copy.getByRole('link', { name: `${STARTER_SETS[1]!.title} (copy)` })).toBeTruthy();
    const [stored] = await listSets();
    expect(stored).toMatchObject({ questions: STARTER_SETS[1]!.questions, createdAt: FIRST_VISIT });
    expect(stored!.id).not.toBe(STARTER_SETS[1]!.id);
  });

  it('Host this set on the built-in sample creates a room and uploads its 2 pictures', async () => {
    const fetch = stubServer();
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: /^Host / }));

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
    fireEvent.click((await card(hard.title)).getByRole('button', { name: /^Host / }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    const { set } = bodyOf(fetch);
    expect(set).toEqual(hard);
    expect(new Set(set.questions.map((q) => q.points))).toEqual(new Set([300]));
  });

  it('Room created gets a content-width page and sets its columns from its own width (B01)', async () => {
    stubServer();
    renderSets();
    fireEvent.click((await card(SAMPLE_SET.title)).getByRole('button', { name: /^Host / }));

    const region = await screen.findByRole('region', { name: 'Room created' });
    expect(document.querySelector('[data-width]')?.getAttribute('data-width')).toBe('content');
    // Two to a row only when the card itself is wide enough, not whenever the window is.
    expect(region.className).toContain('@container/room');
    const grid = within(region).getAllByRole('button')[0]!.parentElement!;
    expect(grid.className).toContain('@xl/room:grid-cols-2');
    expect(grid.className).not.toContain('md:grid-cols-2');
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
    fireEvent.click(preview.getByRole('button', { name: /^Host / }));

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
    await chooseInMenu('Animals – Easy', 'Duplicate to My sets');
    await card('Animals – Easy (copy)');
    expect(await selectedTab()).toBe('My sets');
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
    expect(screen.getByRole('button', { name: 'Easy' }).getAttribute('aria-pressed')).toBe('false');
  });

  it("search finds my sets by title, and Enter focuses the one left's title link", async () => {
    await addOwn();
    await db.sets.add({ ...draft('newer', 'Newer quiz', []), updatedAt: FIRST_VISIT + 1 });
    renderSets();
    await card('Newer quiz');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'pub' },
    });
    expect(cardTitles()).toEqual([OWN.title]);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: OWN.title }));
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

  it("the card's title opens the set editor (LIB-02)", async () => {
    await addOwn();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('link', { name: OWN.title }));
    expect(screen.getByTestId('path').textContent).toBe(`/sets/${OWN.id}`);
  });

  it('Open in the ⋯ menu goes to the set editor', async () => {
    await addOwn();
    renderSets();
    await chooseInMenu(OWN.title, 'Open');
    expect(screen.getByTestId('path').textContent).toBe(`/sets/${OWN.id}`);
  });

  it('the ⋯ menu holds Open, Duplicate, Export JSON, then Delete in red (LIB-02, FND-07)', async () => {
    await addOwn();
    renderSets();
    const own = await card(OWN.title);
    expect(own.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      `Host ${OWN.title}`,
      `Preview ${OWN.title}`,
      `More actions for ${OWN.title}`,
    ]);
    const items = (await openMenu(OWN.title)).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Open',
      'Duplicate',
      'Export JSON',
      'Delete',
    ]);
    expect(items.map((item) => item.className.includes('text-buzz'))).toEqual([
      false,
      false,
      false,
      true,
    ]);
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
    await chooseInMenu(OWN.title, 'Duplicate');
    const copy = await card(`${OWN.title} (copy)`);
    expect(copy.getByText(/^10 questions/)).toBeTruthy();
    expect(await listSets()).toHaveLength(2);
    expect(await toast()).toBe(`Duplicated “${OWN.title}”.`);
  });

  it('Delete asks for confirmation in the menu, and Cancel keeps the set', async () => {
    await addOwn();
    renderSets();
    await chooseInMenu(OWN.title, 'Delete');
    const menu = within(screen.getByRole('menu'));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Open',
      'Duplicate',
      'Export JSON',
      'Confirm delete',
      'Cancel',
    ]);
    expect(menu.getByRole('menuitem', { name: 'Cancel' }).className).not.toContain('text-buzz');
    fireEvent.click(menu.getByRole('menuitem', { name: 'Cancel' }));
    expect(await getSet(OWN.id)).toBeDefined();
    expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
  });

  it('Delete then Confirm delete removes the set and says so', async () => {
    await addOwn();
    renderSets();
    await chooseInMenu(OWN.title, 'Delete');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: OWN.title })).toBeNull());
    expect(await getSet(OWN.id)).toBeUndefined();
    expect(await listSets()).toHaveLength(0);
    expect(await toast()).toBe(`Deleted “${OWN.title}”.`);
  });

  it('Host this set creates a room with that set and offers the Screen choices', async () => {
    await addOwn();
    const fetch = stubServer();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: /^Host / }));

    expect(await screen.findByRole('heading', { name: 'Room created' })).toBeTruthy();
    expect(screen.getByText('WXYZ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This is the Screen' })).toBeTruthy();
    expect(loadHostToken('WXYZ')).toBe(hostToken);
    expect(bodyOf(fetch)).toEqual({ set: OWN, settings: DEFAULT_SETTINGS });
  });

  it('Host this set offers Host remote, which opens /host/<CODE>', async () => {
    await addOwn();
    stubServer();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: /^Host / }));

    fireEvent.click(await screen.findByRole('button', { name: 'Host remote' }));
    expect(screen.getByTestId('path').textContent).toBe('/host/WXYZ');
    expect(loadHostToken('WXYZ')).toBe(hostToken);
  });

  it('every button on the list and on Room created has the hover style', async () => {
    await addOwn();
    stubServer();
    renderSets();
    const own = await card(OWN.title);
    expect(buttonsWithoutHover()).toEqual([]);
    await openMenu(OWN.title);
    expect(buttonsWithoutHover()).toEqual([]);
    fireEvent.click(own.getByRole('button', { name: /^Host / }));
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
    fireEvent.click(own.getByRole('button', { name: /^Host / }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many rooms');
    expect(screen.queryByRole('heading', { name: 'Room created' })).toBeNull();
    expect(localStorage.length).toBe(0);
    await waitFor(() =>
      expect(own.getByRole('button', { name: /^Host / })).toHaveProperty('disabled', false),
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
    fireEvent.click((await card('Draft')).getByRole('button', { name: /^Host / }));
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
      await chooseInMenu(OWN.title, 'Export JSON');
      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(await toast()).toBe(`Exported “${OWN.title}”.`);

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
      await chooseInMenu('Draft', 'Export JSON');
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

    /** The line above My sets about the last Export all. */
    const backupLine = () => screen.getByText(/^(Never exported|Last export)/);

    it('Export all downloads every playable set in one dated file and lists drafts as skipped', async () => {
      const downloads = captureDownloads();
      await addOwn();
      await db.sets.add(draft('d', 'Draft', []));
      renderSets();
      await card(OWN.title);
      expect(backupLine().textContent).toBe('Never exported. Your sets live only in this browser.');

      fireEvent.click(screen.getByRole('button', { name: 'Export all' }));
      await waitFor(() => expect(downloads).toHaveLength(1));

      const fileName = exportAllFileName(FIRST_VISIT);
      expect(downloads[0]!.name).toBe(fileName);
      const file = JSON.parse(await downloads[0]!.text) as {
        sets: (QuestionSet & { images: object })[];
      };
      expect(file.sets.map((set) => set.title)).toEqual([OWN.title]);
      expect(Object.keys(file.sets[0]!.images).sort()).toEqual([
        'sample-img-flag',
        'sample-img-hexagon',
      ]);
      expect((await screen.findByRole('status')).textContent).toBe(
        `Exported 1 set to ${fileName}.`,
      );
      expect(
        within(screen.getByRole('list', { name: 'Skipped sets' }))
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['“Draft”: This set has no questions yet.']);
      expect(backupLine().textContent).toBe(`Last export: ${formatEdited(FIRST_VISIT)}`);
      expect(localStorage.getItem('buzzr:lastExport')).toBe(String(FIRST_VISIT));
    });

    it('Backup holds Import JSON and Export all; Export all there downloads the backup (LIB-03)', async () => {
      const downloads = captureDownloads();
      await addOwn();
      renderSets();
      await card(OWN.title);
      fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
      const menu = within(screen.getByRole('menu', { name: 'Backup' }));
      expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Import JSON',
        'Export all',
      ]);
      fireEvent.click(menu.getByRole('menuitem', { name: 'Export all' }));
      await waitFor(() => expect(downloads).toHaveLength(1));
      expect(downloads[0]!.name).toBe(exportAllFileName(FIRST_VISIT));
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('Import JSON in Backup opens the file chooser', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const choose = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
      fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Import JSON' }));
      expect(choose).toHaveBeenCalledOnce();
      expect(choose.mock.contexts[0]).toBe(screen.getByTestId('import-file'));
    });

    it('Export all in Backup is off while this browser has no set', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      fireEvent.click(screen.getByRole('button', { name: 'Backup' }));
      expect(
        screen.getByRole('menuitem', { name: 'Export all' }).getAttribute('aria-disabled'),
      ).toBe('true');
    });

    it("an import's result is scrolled into view, as it shows at the top (LIB-04)", async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const scrolled = vi.mocked(Element.prototype.scrollIntoView);
      scrolled.mockClear();
      chooseFile('not json', 'broken.json');
      const alert = await screen.findByRole('alert');
      expect(scrolled).toHaveBeenCalled();
      expect(scrolled.mock.contexts.at(-1)).toBe(alert.parentElement);
    });

    it('My sets shows the last export this browser made', async () => {
      const lastWeek = FIRST_VISIT - 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('buzzr:lastExport', String(lastWeek));
      await addOwn();
      renderSets();
      await card(OWN.title);
      expect(backupLine().textContent).toBe(`Last export: ${formatEdited(lastWeek)}`);
    });

    it('Export all with only drafts says so and downloads nothing', async () => {
      const downloads = captureDownloads();
      await db.sets.add(draft('d', 'Draft', []));
      renderSets();
      await card('Draft');
      fireEvent.click(screen.getByRole('button', { name: 'Export all' }));

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Nothing to export: none of your sets is playable yet.',
      );
      expect(screen.getByRole('list', { name: 'Skipped sets' }).textContent).toBe(
        '“Draft”: This set has no questions yet.',
      );
      expect(downloads).toEqual([]);
      expect(backupLine().textContent).toMatch(/^Never exported/);
    });

    it('Import JSON of a many-set file adds each good set and lists each bad one', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const textOnly = SAMPLE_SET.questions.filter((q) => q.imageId === undefined);
      const good = (title: string) => ({ ...SAMPLE_SET, title, questions: textOnly });
      chooseFile(
        JSON.stringify({
          sets: [good('First'), { ...good('Broken'), questions: [] }, good('Third')],
        }),
        'backup.json',
      );

      expect(await screen.findByRole('listitem', { name: 'First' })).toBeTruthy();
      expect(screen.getByRole('listitem', { name: 'Third' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Imported 2 sets.');
      expect(await selectedTab()).toBe('My sets');
      const alert = screen.getByRole('alert');
      expect(within(alert).getByText("Couldn't import 1 of 3 sets from backup.json:")).toBeTruthy();
      expect(
        within(within(alert).getByRole('list', { name: 'Set 2 “Broken”' }))
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Questions: Too small: expected array to have >=1 items']);
      expect((await listSets()).map((set) => set.title).sort()).toEqual(['First', 'Third']);
    });

    it('Import JSON of a bare array adds each set, with category and level from its title', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const textOnly = SAMPLE_SET.questions.filter((q) => q.imageId === undefined);
      const levels = ['Easy', 'Medium', 'Hard'];
      chooseFile(
        JSON.stringify(
          levels.map((l) => ({ ...SAMPLE_SET, title: `Math – ${l}`, questions: textOnly })),
        ),
        'math.json',
      );

      expect(await screen.findByRole('listitem', { name: 'Math – Easy' })).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Imported 3 sets.');
      expect(screen.queryByRole('alert')).toBeNull();
      const stored = (await listSets()).sort((a, b) => a.title.localeCompare(b.title));
      expect(
        stored.map(({ title, category, difficulty }) => [title, category, difficulty]),
      ).toEqual([
        ['Math – Easy', 'Math', 'easy'],
        ['Math – Hard', 'Math', 'hard'],
        ['Math – Medium', 'Math', 'medium'],
      ]);
    });

    it('Import JSON of the same bare array twice adds its sets twice', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const textOnly = SAMPLE_SET.questions.filter((q) => q.imageId === undefined);
      const file = JSON.stringify(
        ['Easy', 'Hard'].map((l) => ({ ...SAMPLE_SET, title: `Math – ${l}`, questions: textOnly })),
      );
      chooseFile(file, 'math.json');
      await screen.findByRole('listitem', { name: 'Math – Easy' });
      chooseFile(file, 'math.json');

      await waitFor(async () => expect(await listSets()).toHaveLength(4));
      expect(new Set((await listSets()).map((set) => set.id)).size).toBe(4);
    });

    it('Import JSON of a many-set file still shows the sets stored before a failed write', async () => {
      renderSets();
      await card(SAMPLE_SET.title);
      const add = db.sets.add.bind(db.sets);
      vi.spyOn(db.sets, 'add').mockImplementation((set) =>
        set.title === 'Second' ? Dexie.Promise.reject(new Error('Disk full.')) : add(set),
      );
      const textOnly = SAMPLE_SET.questions.filter((q) => q.imageId === undefined);
      const good = (title: string) => ({ ...SAMPLE_SET, title, questions: textOnly });
      chooseFile(JSON.stringify({ sets: [good('First'), good('Second')] }), 'backup.json');

      expect(await screen.findByRole('listitem', { name: 'First' })).toBeTruthy();
      expect((await screen.findByRole('alert')).textContent).toBe('Disk full.');
      expect(screen.getByRole('status').textContent).toBe('Imported 1 set.');
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

describe('Set list /sets, header and tabs (F94)', () => {
  it('the header starts with a home link, then New set, Build a game and Backup (LIB-03, LIB-08)', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: '← Buzzr' }).getAttribute('href')).toBe('/');
    expect(
      header.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['New set', 'Build a game', 'Backup']);
    expect(header.getByRole('button', { name: 'New set' }).className).toContain('bg-accent');
  });

  it('the page is the wide shell (LIB-01)', async () => {
    renderSets();
    await card(SAMPLE_SET.title);
    expect(screen.getByRole('main').parentElement!.dataset.width).toBe('wide');
  });

  it('the tabs show their counts, and look unlike the difficulty chips (LIB-05)', async () => {
    await addOwn();
    renderSets();
    await card(OWN.title);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      `Built-in ${BUILT_IN_SETS.length}`,
      'My sets 1',
    ]);
    const chip = screen.getByRole('button', { name: 'Easy' });
    expect(tab('My sets').className).toContain('border-b-4');
    expect(tab('My sets').className).not.toContain('rounded-full');
    expect(chip.className).toContain('rounded-full');
  });

  it('a failed card action is a toast, not a message at the top of the page (LIB-04)', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(Response.json({ ok: false, error: 'Too many rooms' }, { status: 429 })),
    );
    await addOwn();
    renderSets();
    fireEvent.click((await card(OWN.title)).getByRole('button', { name: /^Host / }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Too many rooms');
    expect(alert.className).toContain('fixed');
  });
});
