// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminDraftResponse,
  AdminJobsResponse,
  GenerateJob,
  Question,
  QuestionSet,
} from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  CATEGORIES,
  LocationProbe,
  RIVERS,
  bodyOf,
  callsTo,
  catalog,
  job,
  json,
  nextPoll,
  settle,
  signedIn,
  stubServer,
  type Answer,
  AdminRoutes,
} from '../test/adminServer.js';
import { AdminLevel, checkEdit } from './AdminLevel.js';

const DRAFT = 'GET /api/admin/built-in-sets/riv-m/draft';
const PUT_Q2 = 'PUT /api/admin/built-in-sets/riv-m/questions/q2';
const DELETE_Q2 = 'DELETE /api/admin/built-in-sets/riv-m/questions/q2';
const REVIEWED = 'POST /api/admin/built-in-sets/riv-m/reviewed';
const JOBS = 'GET /api/admin/jobs?setId=riv-m';
const REPLACE_Q2 = 'POST /api/admin/built-in-sets/riv-m/questions/q2/replace';
const ADD = 'POST /api/admin/built-in-sets/riv-m/questions/add';

const jobsOf = (...jobs: GenerateJob[]): Answer => json({ jobs } satisfies AdminJobsResponse);

const QUESTIONS: Question[] = [
  { id: 'q1', text: 'Longest river in Africa?', answer: 'The Nile', points: 100 },
  {
    id: 'q2',
    text: 'Which river flows through Baghdad?',
    answer: 'Tigris',
    hostNotes: 'Not the Euphrates.',
    points: 200,
  },
  { id: 'q3', text: 'Which river forms the Grand Canyon?', answer: 'Colorado', points: 300 },
];

const SET: QuestionSet = {
  id: 'riv-m',
  title: 'Rivers – Medium',
  questions: QUESTIONS,
  createdAt: 1,
  updatedAt: 1,
  schemaVersion: 1,
  category: 'Rivers',
  difficulty: 'medium',
};

const draft = (set: QuestionSet = SET, isDraft = true): Answer =>
  json({ set, draft: isDraft, live: false } satisfies AdminDraftResponse);

const RIVERS_UNREVIEWED = {
  ...RIVERS,
  levels: RIVERS.levels.map((l) => (l.setId === 'riv-m' ? { ...l, reviewed: false } : l)),
};
/** Rivers with Medium a generated draft, not reviewed yet. */
const UNREVIEWED = catalog([RIVERS_UNREVIEWED]);

function renderAt(
  routes: Record<string, Answer[]>,
  url = '/admin/categories/Rivers/riv-m',
  container?: HTMLElement,
) {
  const calls = stubServer({
    'GET /api/admin/session': [signedIn],
    [JOBS]: [jobsOf()],
    ...routes,
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoutes path="/admin/categories/:name/:setId" page={<AdminLevel />} />
      <LocationProbe />
    </MemoryRouter>,
    container ? { container } : undefined,
  );
  return calls;
}

const card = (n: number) => screen.getByRole('article', { name: `Question ${n}` });
const where = () => screen.getByTestId('location').textContent;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetAdminSession();
});

describe('checkEdit', () => {
  const q = QUESTIONS[1]!;

  it('trims the fields and drops blank notes', () => {
    expect(checkEdit(q, { text: '  New text ', answer: ' Tigris ', hostNotes: '  ' })).toEqual({
      ok: true,
      body: { text: 'New text', answer: 'Tigris' },
    });
  });

  it('names each field the shared question schema refuses', () => {
    expect(checkEdit(q, { text: ' ', answer: '', hostNotes: 'x' })).toEqual({
      ok: false,
      errors: { text: 'A question needs text or an image', answer: 'The answer is required' },
    });
  });

  it('lets a picture question keep blank text', () => {
    expect(checkEdit({ ...q, imageId: 'img1' }, { text: '', answer: 'A', hostNotes: '' }).ok).toBe(
      true,
    );
  });
});

describe('Level review list', () => {
  it('shows a card per question: number, points, text, answer and notes', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Medium' })).toBeTruthy();
    expect(screen.getByText('3 questions')).toBeTruthy();
    const items = within(screen.getByRole('list', { name: 'Questions' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const second = within(card(2));
    expect(second.getByRole('heading', { name: 'Question 2' })).toBeTruthy();
    expect(second.getByText('200 points')).toBeTruthy();
    expect(second.getByText('Which river flows through Baghdad?')).toBeTruthy();
    expect(second.getByText('Tigris')).toBeTruthy();
    expect(second.getByText('Not the Euphrates.')).toBeTruthy();
    // No notes, no Notes line.
    expect(within(card(1)).queryByText('Notes')).toBeNull();
  });

  it('links back to the category and to the full editor', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    fireEvent.click(await screen.findByRole('link', { name: 'Open in the full editor' }));
    expect(where()).toBe('/admin/sets/riv-m');
  });

  it('the heading is the level, with the category above it as the way back', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    const heading = await screen.findByRole('heading', { level: 1, name: 'Medium' });
    const back = screen.getByRole('link', { name: '← Rivers' });
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Rivers – Medium' })).toBeNull();
    fireEvent.click(back);
    expect(where()).toBe('/admin/categories/Rivers');
  });

  it('Edit opens the fields, and Save sends only that question through the per-question PUT', async () => {
    const saved = { ...QUESTIONS[1]!, text: 'Which river runs through Baghdad?' };
    delete saved.hostNotes;
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [PUT_Q2]: [draft({ ...SET, questions: [QUESTIONS[0]!, saved, QUESTIONS[2]!] })],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    const edit = within(card(2));
    expect((edit.getByLabelText('Answer') as HTMLInputElement).value).toBe('Tigris');
    fireEvent.change(edit.getByLabelText('Question'), {
      target: { value: 'Which river runs through Baghdad? ' },
    });
    fireEvent.change(edit.getByLabelText('Notes (optional)'), { target: { value: '' } });
    fireEvent.click(edit.getByRole('button', { name: 'Save' }));

    expect(await within(card(2)).findByText('Which river runs through Baghdad?')).toBeTruthy();
    expect(within(card(2)).queryByText('Not the Euphrates.')).toBeNull();
    expect(within(card(2)).queryByLabelText('Question')).toBeNull();
    expect(bodyOf(calls, PUT_Q2)).toEqual({
      text: 'Which river runs through Baghdad?',
      answer: 'Tigris',
    });
    // Never a whole-set save.
    expect(calls.some((c) => c.key.includes('/draft') && c.init?.method === 'PUT')).toBe(false);
  });

  it('refuses a blank answer with the schema message and sends nothing', async () => {
    const calls = renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    const edit = within(card(2));
    fireEvent.change(edit.getByLabelText('Answer'), { target: { value: '   ' } });
    fireEvent.click(edit.getByRole('button', { name: 'Save' }));
    expect(edit.getByText('The answer is required')).toBeTruthy();
    expect(edit.getByLabelText('Answer').getAttribute('aria-invalid')).toBe('true');
    expect(callsTo(calls, PUT_Q2)).toBe(0);
  });

  it('Cancel restores the card as it was', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    fireEvent.change(within(card(2)).getByLabelText('Answer'), { target: { value: 'Euphrates' } });
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Cancel' }));
    expect(within(card(2)).getByText('Tigris')).toBeTruthy();
    expect(within(card(2)).queryByText('Euphrates')).toBeNull();
    // Opening it again starts from the question, not the abandoned edit.
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 2' }));
    expect((within(card(2)).getByLabelText('Answer') as HTMLInputElement).value).toBe('Tigris');
  });

  it('a failed save keeps the edit open with the server message', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [PUT_Q2]: [json({ error: 'The draft has no question with that id.' }, 404)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    fireEvent.change(within(card(2)).getByLabelText('Answer'), { target: { value: 'Tigris R.' } });
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Save' }));
    expect((await within(card(2)).findByRole('alert')).textContent).toBe(
      'The draft has no question with that id.',
    );
    expect((within(card(2)).getByLabelText('Answer') as HTMLInputElement).value).toBe('Tigris R.');
    expect(within(card(2)).getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('Remove asks first, then deletes the question and renumbers the rest', async () => {
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [DELETE_Q2]: [draft({ ...SET, questions: [QUESTIONS[0]!, QUESTIONS[2]!] })],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove question 2' }));
    expect(callsTo(calls, DELETE_Q2)).toBe(0);
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Confirm remove' }));
    expect(await screen.findByText('2 questions')).toBeTruthy();
    expect(screen.queryByText('Which river flows through Baghdad?')).toBeNull();
    expect(within(card(2)).getByText('Colorado')).toBeTruthy();
    expect(callsTo(calls, DELETE_Q2)).toBe(1);
  });

  it('a failed remove keeps the card with the server message', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [DELETE_Q2]: [json({ error: 'Could not save. Try again.' }, 500)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove question 2' }));
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Confirm remove' }));
    expect((await within(card(2)).findByRole('alert')).textContent).toBe(
      'Could not save. Try again.',
    );
    expect(screen.getByText('3 questions')).toBeTruthy();
  });

  it('Mark <level> reviewed calls the reviewed route and then shows Reviewed', async () => {
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [REVIEWED]: [json({ setId: 'riv-m', reviewed: true })],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Medium reviewed' }));
    expect((await screen.findByRole('status')).textContent).toContain('Reviewed');
    expect(screen.queryByRole('button', { name: 'Mark Medium reviewed' })).toBeNull();
    expect(callsTo(calls, REVIEWED)).toBe(1);
  });

  it('a failed mark keeps the button with the server message', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [REVIEWED]: [json({ error: 'There is no draft with that id.' }, 404)],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Medium reviewed' }));
    expect((await screen.findByRole('alert')).textContent).toBe('There is no draft with that id.');
    expect(screen.getByRole('button', { name: 'Mark Medium reviewed' })).toBeTruthy();
  });

  it('a level already reviewed shows Reviewed without the button', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [catalog()] });
    expect((await screen.findByRole('status')).textContent).toContain('Reviewed');
    expect(screen.queryByRole('button', { name: /reviewed/ })).toBeNull();
  });

  it('a set without a difficulty is named by its title', async () => {
    const plain = { ...SET, title: 'River trivia' };
    delete plain.difficulty;
    renderAt({ [DRAFT]: [draft(plain)], [CATEGORIES]: [UNREVIEWED] });
    expect(await screen.findByRole('button', { name: 'Mark River trivia reviewed' })).toBeTruthy();
  });

  it('a choice question keeps its answer, which only the full editor changes', async () => {
    const choice: Question = {
      id: 'q2',
      text: 'Pick the longest',
      answer: 'Nile',
      points: 100,
      mode: 'choice',
      choices: ['Nile', 'Thames'],
      correctChoice: 0,
    };
    renderAt({
      [DRAFT]: [draft({ ...SET, questions: [QUESTIONS[0]!, choice] })],
      [CATEGORIES]: [UNREVIEWED],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    const answer = within(card(2)).getByLabelText('Answer') as HTMLInputElement;
    expect(answer.disabled).toBe(true);
    expect(answer.value).toBe('Nile');
  });

  it("a typed question's notes are its other accepted answers", async () => {
    const typed: Question = { ...QUESTIONS[1]!, mode: 'typed', hostNotes: 'The Tigris' };
    renderAt({
      [DRAFT]: [draft({ ...SET, questions: [QUESTIONS[0]!, typed] })],
      [CATEGORIES]: [UNREVIEWED],
    });
    await screen.findByRole('heading', { level: 1, name: 'Medium' });
    expect(within(card(2)).getByText('Also accepted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 2' }));
    const field = within(card(2)).getByLabelText('Other accepted answers (optional)');
    expect((field as HTMLTextAreaElement).value).toBe('The Tigris');
  });

  it('a live set with no draft has nothing to review', async () => {
    renderAt({ [DRAFT]: [draft(SET, false)], [CATEGORIES]: [catalog()] });
    expect(await screen.findByText('This set is live and has no draft to review.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Questions' })).toBeNull();
  });

  it('an unknown set says so', async () => {
    renderAt({ [DRAFT]: [json({ error: 'no' }, 404)], [CATEGORIES]: [catalog()] });
    expect(await screen.findByText('There is no set with this id.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Rivers' })).toBeTruthy();
  });

  it('a failed load offers Retry', async () => {
    const offline: Answer = () => {
      throw new TypeError('Failed to fetch');
    };
    renderAt({
      [DRAFT]: [draft(), draft()],
      [CATEGORIES]: [offline, catalog()],
      [JOBS]: [jobsOf(), jobsOf()],
    });
    // The first categories fetch fails as a network error; the retry has an answer.
    expect((await screen.findByRole('alert')).textContent).toMatch(/reach the server/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Medium' })).toBeTruthy();
  });

  it('asks a visitor who is not signed in to sign in as admin', async () => {
    stubServer({ 'GET /api/admin/session': [json({ error: 'no' }, 401)] });
    render(
      <MemoryRouter initialEntries={['/admin/categories/Rivers/riv-m']}>
        <AdminRoutes path="/admin/categories/:name/:setId" page={<AdminLevel />} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Only the admin can open this page/)).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});

describe('Preview on Screen (F124)', () => {
  const preview = () => screen.getByRole('dialog');
  const shown = () => within(preview()).getByRole('heading', { level: 1 }).textContent;
  const previewButton = (n: number) =>
    within(card(n)).getByRole('button', { name: `Preview question ${n}` });

  /** Clicks a card's Preview as a pointer would: focus first, which jsdom's click skips. */
  async function open(n: number) {
    const button = await screen.findByRole('button', { name: `Preview question ${n}` });
    button.focus();
    fireEvent.click(button);
  }

  it("opens the Screen's render of that question, without its answer or notes", async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await open(2);
    expect(preview().getAttribute('aria-label')).toBe('Preview of question 2');
    expect(shown()).toBe('Which river flows through Baghdad?');
    expect(preview().textContent).not.toContain('Tigris');
    expect(preview().textContent).not.toContain('Not the Euphrates.');
    // The same component as the editor's: Show answer switches to the reveal.
    fireEvent.click(within(preview()).getByRole('button', { name: 'Show answer' }));
    expect(preview().textContent).toContain('Tigris');
  });

  it('← and → (and the buttons) move through the level and stop at its ends', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await open(2);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shown()).toBe('Which river forms the Grand Canyon?');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(shown()).toBe('Which river forms the Grand Canyon?');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(shown()).toBe('Longest river in Africa?');
    expect(
      (within(preview()).getByRole('button', { name: '← Previous' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(within(preview()).getByRole('button', { name: 'Next →' }));
    expect(shown()).toBe('Which river flows through Baghdad?');
  });

  it("Esc closes it and focus goes back to the card's Preview button", async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await open(2);
    expect(document.activeElement).toBe(within(preview()).getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(previewButton(2));
  });

  it('after moving, Close returns focus to the Preview button of the question shown', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await open(1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(within(preview()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(previewButton(3));
  });

  it('the app behind it is inert while it is open', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    try {
      renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] }, undefined, root);
      await open(1);
      expect(root.hasAttribute('inert')).toBe(true);
      // The preview itself is outside the app root, so it stays usable.
      expect(root.contains(preview())).toBe(false);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(root.hasAttribute('inert')).toBe(false);
    } finally {
      cleanup();
      root.remove();
    }
  });

  it('shows an edit once it is saved', async () => {
    const saved = { ...QUESTIONS[1]!, text: 'Which river runs through Baghdad?' };
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [PUT_Q2]: [draft({ ...SET, questions: [QUESTIONS[0]!, saved, QUESTIONS[2]!] })],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: saved.text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await open(2);
    expect(shown()).toBe('Which river runs through Baghdad?');
  });
});

describe('Replace and Add a question (F118)', () => {
  const NEW_Q2: Question = {
    id: 'q2',
    text: 'Which river flows through Cairo?',
    answer: 'The Nile',
    points: 200,
  };
  const ADDED: Question = {
    id: 'q9',
    text: 'Which river flows through Vienna?',
    answer: 'The Danube',
    points: 200,
  };
  const replaceJob = (over: Partial<GenerateJob> = {}) =>
    job({
      id: 'r1',
      kind: 'replace',
      setId: 'riv-m',
      category: 'Rivers',
      levels: [{ difficulty: 'medium', count: 1 }],
      questionId: 'q2',
      state: 'queued',
      currentLevel: null,
      ...over,
    });
  const doneJob = replaceJob({
    state: 'done',
    replaced: { old: QUESTIONS[1]!, new: NEW_Q2 },
    finishedAt: 5,
  });
  const started = (id = 'r1') => json({ jobId: id }, 202);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function openReplace(note = '') {
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Replace question 2' }));
    const field = within(card(2)).getByLabelText('Why replace? (optional)');
    expect(field.getAttribute('maxlength')).toBe('200');
    if (note) fireEvent.change(field, { target: { value: note } });
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Replace' }));
    await settle();
  }

  it('Replace asks for an optional note, sends it, and shows the queue place with Cancel', async () => {
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED, UNREVIEWED],
      [REPLACE_Q2]: [started()],
      [JOBS]: [jobsOf(), jobsOf(replaceJob({ queuePosition: 2 }))],
    });
    await openReplace('  too easy ');
    expect(bodyOf(calls, REPLACE_Q2)).toEqual({ note: 'too easy' });
    expect(within(card(2)).getByRole('status').textContent).toBe('Queued · 2nd');
    expect(
      within(card(2)).getByRole('button', { name: 'Cancel replacing question 2' }),
    ).toBeTruthy();
    // The card's own buttons wait; the other cards stay usable.
    expect(
      (within(card(2)).getByRole('button', { name: 'Edit question 2' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Edit question 1' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('button', { name: 'Replace question 1' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('Cancel in the note form sends nothing', async () => {
    const calls = renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Replace question 2' }));
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Cancel' }));
    expect(within(card(2)).queryByLabelText('Why replace? (optional)')).toBeNull();
    expect(callsTo(calls, REPLACE_Q2)).toBe(0);
  });

  it('several cards can be queued, and a running one shows a spinner line', async () => {
    const q3 = replaceJob({ id: 'r3', questionId: 'q3', queuePosition: 1 });
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [jobsOf(replaceJob({ state: 'writing', currentLevel: 'medium' }), q3)],
    });
    await settle();
    expect(within(card(2)).getByRole('status').textContent).toBe('Writing a new question…');
    expect(within(card(3)).getByRole('status').textContent).toBe('Queued · 1st');
  });

  it('a finished replacement swaps in at once and Undo puts the old one back through the PUT', async () => {
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [REPLACE_Q2]: [started()],
      [JOBS]: [jobsOf(), jobsOf(replaceJob({ state: 'writing' })), jobsOf(doneJob)],
      [PUT_Q2]: [draft()],
    });
    await openReplace();
    expect(within(card(2)).getByRole('status').textContent).toBe('Writing a new question…');
    await nextPoll();
    expect(within(card(2)).getByText('Which river flows through Cairo?')).toBeTruthy();
    expect(within(card(2)).getByRole('status').textContent).toBe('Replaced');
    fireEvent.click(within(card(2)).getByRole('button', { name: 'Undo replacing question 2' }));
    await settle();
    expect(within(card(2)).getByText('Which river flows through Baghdad?')).toBeTruthy();
    expect(bodyOf(calls, PUT_Q2)).toEqual({
      text: 'Which river flows through Baghdad?',
      answer: 'Tigris',
      hostNotes: 'Not the Euphrates.',
    });
    expect(within(card(2)).queryByRole('button', { name: /Undo/ })).toBeNull();
  });

  it('a replacement that ended before the page opened is not offered for Undo', async () => {
    renderAt({
      [DRAFT]: [draft({ ...SET, questions: [QUESTIONS[0]!, NEW_Q2, QUESTIONS[2]!] })],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [jobsOf(doneJob)],
    });
    await settle();
    expect(within(card(2)).queryByRole('button', { name: /Undo/ })).toBeNull();
  });

  it('Cancel on a queued replacement takes it off the card', async () => {
    const CANCEL = 'POST /api/admin/jobs/r1/cancel';
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [jobsOf(replaceJob({ queuePosition: 1 }))],
      [CANCEL]: [json(replaceJob({ state: 'cancelled' }))],
    });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel replacing question 2' }));
    await settle();
    expect(callsTo(calls, CANCEL)).toBe(1);
    expect(within(card(2)).queryByRole('status')).toBeNull();
    expect(within(card(2)).getByText('Which river flows through Baghdad?')).toBeTruthy();
  });

  it('Cancel on a running one reads Cancelling… until the poll shows it stopped', async () => {
    const CANCEL = 'POST /api/admin/jobs/r1/cancel';
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [
        jobsOf(replaceJob({ state: 'writing' })),
        jobsOf(replaceJob({ state: 'cancelled' })),
      ],
      [CANCEL]: [json(replaceJob({ state: 'writing' }))],
    });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel replacing question 2' }));
    await settle();
    expect(within(card(2)).getByRole('status').textContent).toBe('Cancelling…');
    await nextPoll();
    expect(within(card(2)).queryByRole('status')).toBeNull();
  });

  it('a failed replacement shows its message on the card', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [
        jobsOf(replaceJob({ state: 'writing' })),
        jobsOf(replaceJob({ state: 'failed', error: 'Claude could not be reached.' })),
      ],
    });
    await settle();
    await nextPoll();
    expect(within(card(2)).getByRole('alert').textContent).toBe(
      'The replacement failed: Claude could not be reached.',
    );
    expect(
      (screen.getByRole('button', { name: 'Replace question 2' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('a refused start keeps the note form open with the server message', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [REPLACE_Q2]: [json({ error: 'Daily limit reached: 100 replacements a day.' }, 429)],
    });
    await openReplace();
    expect(within(card(2)).getByRole('alert').textContent).toBe(
      'Daily limit reached: 100 replacements a day.',
    );
    expect(within(card(2)).getByLabelText('Why replace? (optional)')).toBeTruthy();
  });

  it('Add a question appends the new question when it arrives', async () => {
    const add = replaceJob({ id: 'a1', questionId: null });
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [ADD]: [started('a1')],
      [JOBS]: [
        jobsOf(),
        jobsOf({ ...add, queuePosition: 1 }),
        jobsOf({ ...add, state: 'done', replaced: { old: null, new: ADDED } }),
      ],
    });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Add a question' }));
    fireEvent.change(screen.getByLabelText('Anything the new question should be? (optional)'), {
      target: { value: 'about Europe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await settle();
    expect(bodyOf(calls, ADD)).toEqual({ note: 'about Europe' });
    const section = within(screen.getByRole('region', { name: 'Add a question' }));
    expect(section.getByRole('status').textContent).toBe('Queued · 1st');
    await nextPoll();
    expect(screen.getByText('4 questions')).toBeTruthy();
    expect(within(card(4)).getByText('Which river flows through Vienna?')).toBeTruthy();
    expect(within(card(4)).getByText('Added')).toBeTruthy();
    expect(section.queryByRole('status')).toBeNull();
  });

  it('shows the replacements left today, and at the cap Replace and Add read Daily limit reached', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [catalog([RIVERS], { replacements: { usedToday: 97, dailyLimit: 100 } })],
    });
    await settle();
    expect(screen.getByText('3 of 100 replacements left today (UTC).')).toBeTruthy();
    cleanup();
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [catalog([RIVERS], { replacements: { usedToday: 100, dailyLimit: 100 } })],
    });
    await settle();
    expect(screen.getByText('0 of 100 replacements left today (UTC).')).toBeTruthy();
    const limited = screen.getAllByRole('button', { name: 'Daily limit reached' });
    // Three cards and Add.
    expect(limited).toHaveLength(4);
    expect(limited.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Add a question' })).toBeNull();
  });

  it("counts this list's queued replacements against what is left", async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [catalog([RIVERS], { replacements: { usedToday: 98, dailyLimit: 100 } })],
      [JOBS]: [
        jobsOf(
          replaceJob({ queuePosition: 1 }),
          replaceJob({ id: 'r3', questionId: 'q3', queuePosition: 2 }),
        ),
      ],
    });
    await settle();
    expect(screen.getByText('0 of 100 replacements left today (UTC).')).toBeTruthy();
    const section = within(screen.getByRole('region', { name: 'Add a question' }));
    expect(
      (section.getByRole('button', { name: 'Daily limit reached' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Replace question 1' })).toBeNull();
  });

  it('without generation, Replace and Add are off and say why', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [catalog([RIVERS], { enabled: false })] });
    await settle();
    expect(screen.getByText(/needs generation, which is not set up/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Replace question 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Add a question' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('polls every 2 s only while a job is queued or running', async () => {
    const calls = renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [
        jobsOf(replaceJob({ state: 'writing' })),
        jobsOf(replaceJob({ state: 'writing' })),
        jobsOf(doneJob),
      ],
    });
    await settle();
    expect(callsTo(calls, JOBS)).toBe(1);
    await nextPoll();
    expect(callsTo(calls, JOBS)).toBe(2);
    await nextPoll();
    expect(callsTo(calls, JOBS)).toBe(3);
    await nextPoll();
    await nextPoll();
    expect(callsTo(calls, JOBS)).toBe(3);
  });

  it('Mark reviewed and the full editor wait until no job is queued or running', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [jobsOf(replaceJob({ state: 'writing' })), jobsOf(doneJob)],
    });
    await settle();
    expect(
      (screen.getByRole('button', { name: 'Mark Medium reviewed' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole('link', { name: 'Open in the full editor' })).toBeNull();
    expect(screen.getByText('Open in the full editor').getAttribute('aria-disabled')).toBe('true');
    await nextPoll();
    expect(
      (screen.getByRole('button', { name: 'Mark Medium reviewed' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(screen.getByRole('link', { name: 'Open in the full editor' })).toBeTruthy();
  });

  it('says so after three missed polls, and keeps trying', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [JOBS]: [jobsOf(replaceJob({ state: 'writing' }))],
    });
    await settle();
    await nextPoll();
    await nextPoll();
    expect(screen.queryByText(/Cannot reach the server/)).toBeNull();
    await nextPoll();
    expect(screen.getByText('Cannot reach the server. Still trying every 2 seconds…')).toBeTruthy();
  });

  it("the footer's progress line counts what is replacing and adding, and is gone when idle", async () => {
    const addJob = replaceJob({ id: 'a1', questionId: null, queuePosition: 2 });
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED, UNREVIEWED],
      [JOBS]: [
        jobsOf(
          replaceJob({ state: 'writing' }),
          replaceJob({ id: 'r3', questionId: 'q3', queuePosition: 1 }),
          addJob,
        ),
        jobsOf(
          doneJob,
          replaceJob({ id: 'r3', questionId: 'q3', state: 'cancelled' }),
          replaceJob({ id: 'a1', questionId: null, state: 'cancelled' }),
        ),
      ],
    });
    await settle();
    const footer = within(screen.getByRole('contentinfo', { name: 'Review progress' }));
    expect(footer.getByRole('status').textContent).toBe('2 replacing · 1 adding');
    await nextPoll();
    expect(footer.queryByRole('status')).toBeNull();
  });
});

describe('Review footer and card layout (F122)', () => {
  it('each card reads question, answer and notes, then Edit, Replace, Preview and Remove, Remove last', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    await screen.findByRole('heading', { level: 1, name: 'Medium' });
    const article = card(2);
    const buttons = within(article)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(buttons).toEqual(['Edit', 'Replace', 'Preview', 'Remove']);
    const notes = within(article).getByText('Not the Euphrates.');
    const edit = within(article).getByRole('button', { name: 'Edit question 2' });
    expect(notes.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const heading = within(article).getByRole('heading', { name: 'Question 2' });
    const text = within(article).getByText('Which river flows through Baghdad?');
    expect(heading.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the footer is the sticky last part of the page, with Mark reviewed and what is left today', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [
        catalog([RIVERS_UNREVIEWED], { replacements: { usedToday: 97, dailyLimit: 100 } }),
      ],
    });
    await screen.findByRole('heading', { level: 1, name: 'Medium' });
    const footerEl = screen.getByRole('contentinfo', { name: 'Review progress' });
    expect(footerEl.className).toMatch(/\bsticky\b/);
    expect(footerEl.className).toMatch(/\bbottom-0\b/);
    expect(footerEl.className).toMatch(/short:flex-row/);
    expect(footerEl.parentElement!.lastElementChild).toBe(footerEl);
    const footer = within(footerEl);
    expect(footer.getByRole('button', { name: 'Mark Medium reviewed' })).toBeTruthy();
    expect(footer.getByText('3 of 100 replacements left today (UTC).').className).toMatch(
      /short:hidden/,
    );
    // At `short:` the count is brief, to share one line with the progress and the button.
    expect(footer.getByText('3 of 100 left today').className).toMatch(/short:inline/);
    // Idle: no progress line.
    expect(footer.queryByRole('status')).toBeNull();
  });

  it('the footer shows Reviewed in place of the button once marked', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [REVIEWED]: [json({ setId: 'riv-m', reviewed: true })],
    });
    const footer = within(await screen.findByRole('contentinfo', { name: 'Review progress' }));
    fireEvent.click(await footer.findByRole('button', { name: 'Mark Medium reviewed' }));
    expect((await footer.findByRole('status')).textContent).toBe('✓ Reviewed');
    expect(footer.queryByRole('button')).toBeNull();
  });

  it('the progress line counts the questions edited on this visit', async () => {
    const saved = { ...QUESTIONS[1]!, text: 'Which river runs through Baghdad?' };
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      [PUT_Q2]: [
        draft({ ...SET, questions: [QUESTIONS[0]!, saved, QUESTIONS[2]!] }),
        draft({ ...SET, questions: [QUESTIONS[0]!, saved, QUESTIONS[2]!] }),
      ],
    });
    const footer = within(await screen.findByRole('contentinfo', { name: 'Review progress' }));
    for (let i = 0; i < 2; i++) {
      fireEvent.click(await screen.findByRole('button', { name: 'Edit question 2' }));
      fireEvent.change(within(card(2)).getByLabelText('Question'), {
        target: { value: saved.text },
      });
      fireEvent.click(within(card(2)).getByRole('button', { name: 'Save' }));
      // The same question saved twice counts once.
      expect((await footer.findByRole('status')).textContent).toBe('1 edited');
    }
  });
});

describe('Duplicate and long-text warnings (F123)', () => {
  const EASY = 'GET /api/admin/built-in-sets/riv-e/draft';
  const HARD = 'GET /api/admin/built-in-sets/riv-h/draft';
  const easy: QuestionSet = {
    ...SET,
    id: 'riv-e',
    title: 'Rivers – Easy',
    difficulty: 'easy',
    questions: [
      { id: 'q1', text: 'Which river runs through Paris?', answer: 'Seine', points: 100 },
      { id: 'q2', text: 'Which river flows through Baghdad today?', answer: 'Tigris', points: 100 },
    ],
  };
  const warningsOf = (n: number) =>
    screen.queryByRole('list', { name: `Warnings for question ${n}` });

  it('a card names a repeat in another level, and the footer counts it, without blocking', async () => {
    renderAt({
      [DRAFT]: [draft()],
      [CATEGORIES]: [UNREVIEWED],
      // Easy is live (no draft); Hard fails to load and is left out.
      [EASY]: [draft(easy, false)],
    });
    const list = await screen.findByRole('list', { name: 'Warnings for question 2' });
    const lines = within(list).getAllByRole('listitem');
    expect(lines.map((l) => l.textContent)).toEqual([
      '⚠ Same answer as Easy Q2',
      '⚠ Nearly the same question as Easy Q2',
    ]);
    expect(lines[0]!.className).toMatch(/text-warn/);
    expect(warningsOf(1)).toBeNull();
    expect(warningsOf(3)).toBeNull();
    const footer = within(screen.getByRole('contentinfo', { name: 'Review progress' }));
    expect(footer.getByText('2 warnings').className).toMatch(/text-warn/);
    expect(
      (footer.getByRole('button', { name: 'Mark Medium reviewed' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('warns about a repeat within the level and about long text', async () => {
    const long = `Which river ${'runs '.repeat(40)}?`;
    const questions = [
      QUESTIONS[0]!,
      { ...QUESTIONS[1]!, text: long, answer: 'Euphrates' },
      { ...QUESTIONS[2]!, answer: 'the nile' },
    ];
    renderAt({
      [DRAFT]: [draft({ ...SET, questions })],
      [CATEGORIES]: [UNREVIEWED],
      [HARD]: [draft({ ...easy, id: 'riv-h', title: 'Rivers – Hard', difficulty: 'hard' })],
    });
    expect((await screen.findByRole('list', { name: 'Warnings for question 1' })).textContent).toBe(
      '⚠ Same answer as Q3',
    );
    expect(warningsOf(2)!.textContent).toBe(
      `⚠ Long question (${long.trim().length} characters): it shows small on the Screen`,
    );
    const footer = within(screen.getByRole('contentinfo', { name: 'Review progress' }));
    expect(footer.getByText('3 warnings')).toBeTruthy();
  });

  it('an edit that removes the repeat clears the warning', async () => {
    const saved = { ...QUESTIONS[2]!, answer: 'Colorado' };
    renderAt({
      [DRAFT]: [
        draft({
          ...SET,
          questions: [QUESTIONS[0]!, QUESTIONS[1]!, { ...saved, answer: 'THE NILE!' }],
        }),
      ],
      [CATEGORIES]: [UNREVIEWED],
      'PUT /api/admin/built-in-sets/riv-m/questions/q3': [
        draft({ ...SET, questions: [QUESTIONS[0]!, QUESTIONS[1]!, saved] }),
      ],
    });
    const footer = within(await screen.findByRole('contentinfo', { name: 'Review progress' }));
    expect(await footer.findByText('2 warnings')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit question 3' }));
    fireEvent.change(within(card(3)).getByLabelText('Answer'), { target: { value: 'Colorado' } });
    fireEvent.click(within(card(3)).getByRole('button', { name: 'Save' }));
    expect(await within(card(3)).findByText('Colorado')).toBeTruthy();
    expect(warningsOf(1)).toBeNull();
    expect(warningsOf(3)).toBeNull();
    expect(footer.queryByText(/warning/)).toBeNull();
  });

  it('the footer says "1 warning" for one', async () => {
    renderAt({
      [DRAFT]: [draft({ ...SET, questions: [{ ...QUESTIONS[0]!, text: 'x'.repeat(200) }] })],
      [CATEGORIES]: [UNREVIEWED],
    });
    const footer = within(await screen.findByRole('contentinfo', { name: 'Review progress' }));
    expect(await footer.findByText('1 warning')).toBeTruthy();
  });
});
