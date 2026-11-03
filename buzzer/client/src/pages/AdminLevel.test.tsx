// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminDraftResponse, Question, QuestionSet } from '../../../shared/types.js';
import { resetAdminSession } from '../lib/adminSession.js';
import {
  CATEGORIES,
  LocationProbe,
  RIVERS,
  bodyOf,
  callsTo,
  catalog,
  json,
  signedIn,
  stubServer,
  type Answer,
} from '../test/adminServer.js';
import { AdminLevel, checkEdit } from './AdminLevel.js';

const DRAFT = 'GET /api/admin/built-in-sets/riv-m/draft';
const PUT_Q2 = 'PUT /api/admin/built-in-sets/riv-m/questions/q2';
const DELETE_Q2 = 'DELETE /api/admin/built-in-sets/riv-m/questions/q2';
const REVIEWED = 'POST /api/admin/built-in-sets/riv-m/reviewed';

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

/** Rivers with Medium a generated draft, not reviewed yet. */
const UNREVIEWED = catalog([
  {
    ...RIVERS,
    levels: RIVERS.levels.map((l) => (l.setId === 'riv-m' ? { ...l, reviewed: false } : l)),
  },
]);

function renderAt(routes: Record<string, Answer[]>, url = '/admin/categories/Rivers/riv-m') {
  const calls = stubServer({ 'GET /api/admin/session': [signedIn], ...routes });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/categories/:name/:setId" element={<AdminLevel />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
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
    expect(await screen.findByRole('heading', { name: 'Rivers – Medium' })).toBeTruthy();
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

  it('Back to <name> returns to the category review', async () => {
    renderAt({ [DRAFT]: [draft()], [CATEGORIES]: [UNREVIEWED] });
    fireEvent.click(await screen.findByRole('link', { name: 'Back to Rivers' }));
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
    await screen.findByRole('heading', { name: 'Rivers – Medium' });
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
    expect(screen.getByRole('link', { name: 'Back to Rivers' })).toBeTruthy();
  });

  it('a failed load offers Retry', async () => {
    const offline: Answer = () => {
      throw new TypeError('Failed to fetch');
    };
    renderAt({ [DRAFT]: [draft(), draft()], [CATEGORIES]: [offline, catalog()] });
    // The first categories fetch fails as a network error; the retry has an answer.
    expect((await screen.findByRole('alert')).textContent).toMatch(/reach the server/);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Rivers – Medium' })).toBeTruthy();
  });

  it('asks a visitor who is not signed in to sign in as admin', async () => {
    stubServer({ 'GET /api/admin/session': [json({ error: 'no' }, 401)] });
    render(
      <MemoryRouter initialEntries={['/admin/categories/Rivers/riv-m']}>
        <Routes>
          <Route path="/admin/categories/:name/:setId" element={<AdminLevel />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Sign in as admin' })).toBeTruthy();
  });
});
