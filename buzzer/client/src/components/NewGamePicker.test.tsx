// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { Phase, QuestionSet } from '../../../shared/types.js';
import { NEW_GAME_TAKEN_MESSAGE } from '../lib/api.js';
import { addImage, db, saveSet } from '../lib/db.js';
import { NewGamePicker } from './NewGamePicker.js';

const FIRST_VISIT = 1_700_000_000_000;

const roundTwo: QuestionSet = {
  ...SAMPLE_SET,
  id: 'set-round-two',
  title: 'Round two',
  questions: [{ id: 'q1', text: 'What?', answer: 'Yes', points: 100 }],
};
const draft: QuestionSet = { ...roundTwo, id: 'set-draft', title: 'Half done', questions: [] };

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
  // This browser's own sets; the built-ins are listed after them, from the bundle.
  await saveSet(roundTwo, FIRST_VISIT + 1);
  await saveSet(draft, FIRST_VISIT + 2);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fake server answering the PUT with `status`; resolves only when `release` is called. */
function stubPut(status = 200) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  const fetch = vi.fn(async () => {
    await gate;
    return status === 200
      ? Response.json({ ok: true })
      : Response.json({ ok: false, error: 'Refused' }, { status });
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, release };
}

function renderPicker(phase: Phase = 'FINAL') {
  const onClose = vi.fn();
  const onNotice = vi.fn();
  const props = { code: 'WXYZ', hostToken: 'token-1', onClose, onNotice };
  const view = render(<NewGamePicker {...props} phase={phase} />);
  return {
    onClose,
    onNotice,
    setPhase: (next: Phase) => view.rerender(<NewGamePicker {...props} phase={next} />),
  };
}

const dialog = () => screen.getByRole('dialog', { name: 'New game' });
const options = () => within(dialog()).findAllByRole<HTMLInputElement>('radio');
const startButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /new game…?$/i });
const putBody = (fetch: { mock: { calls: unknown[] } }) =>
  JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as {
    set: QuestionSet;
    keepScores: boolean;
  };

describe('NewGamePicker', () => {
  it("lists this browser's sets newest first, then the built-ins, the newest picked and drafts marked", async () => {
    renderPicker();
    const radios = await options();
    expect(radios).toHaveLength(2 + 1 + STARTER_SETS.length);
    const labels = radios.map((radio) => radio.closest('label')!.textContent);
    expect(labels).toEqual([
      'Half done0 questions · Not playable yet',
      'Round two1 question',
      `${SAMPLE_SET.title}10 questions · Built-in`,
      ...STARTER_SETS.map((set) => `${set.title}15 questions · Built-in`),
    ]);
    expect(radios[0]!.checked).toBe(true);
  });

  it('starting the built-in sample sends it and uploads its pictures from the bundle', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/set')
        ? Response.json({ ok: true })
        : Response.json({ ok: true }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetch);
    const { onClose } = renderPicker();
    fireEvent.click((await options())[2]!);
    fireEvent.click(startButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/rooms/WXYZ/set',
      `/api/rooms/WXYZ/images/${SAMPLE_HEXAGON_ID}`,
      `/api/rooms/WXYZ/images/${SAMPLE_FLAG_ID}`,
    ]);
    expect(putBody(fetch).set).toEqual(SAMPLE_SET);
  });

  it('sends the picked set with Keep scores off by default', async () => {
    const { fetch, release } = stubPut();
    const { onClose } = renderPicker();
    fireEvent.click((await options())[1]!);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Keep scores' }).checked).toBe(
      false,
    );
    fireEvent.click(startButton());
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('/api/rooms/WXYZ/set');
    expect(putBody(fetch)).toEqual({
      set: { ...roundTwo, updatedAt: FIRST_VISIT + 1 },
      keepScores: false,
    });
  });

  it('sends keepScores true when Keep scores is ticked', async () => {
    const { fetch, release } = stubPut();
    const { onClose } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep scores' }));
    fireEvent.click(startButton());
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putBody(fetch).keepScores).toBe(true);
  });

  it('shows progress and locks the picker until the new game is set up', async () => {
    const { release } = stubPut();
    const { onClose } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(startButton());
    await waitFor(() => expect(startButton().textContent).toBe('Starting new game…'));
    expect(startButton().disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('stays open across the switch to the lobby while its own set uploads', async () => {
    const { release } = stubPut();
    const { onClose, setPhase } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(startButton());
    setPhase('LOBBY');
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('shows why a draft cannot be played, inline, and sends nothing', async () => {
    const { fetch } = stubPut();
    const { onClose } = renderPicker();
    await options();
    fireEvent.click(startButton());
    expect((await screen.findByRole('alert')).textContent).toBe('This set has no questions yet.');
    expect(fetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(startButton().disabled).toBe(false);
  });

  it("shows the server's refusal inline and stays open", async () => {
    const { release } = stubPut(401);
    const { onClose } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(startButton());
    release();
    expect((await screen.findByRole('alert')).textContent).toBe('Refused');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('after an image fails to upload, a retry sends only the images', async () => {
    const image = new Blob(['img'], { type: 'image/png' });
    const imageId = await addImage(image);
    const withImage = {
      ...roundTwo,
      id: 'set-image',
      title: 'With image',
      questions: [{ ...roundTwo.questions[0]!, imageId }],
    };
    await saveSet(withImage, FIRST_VISIT + 3);
    let uploads = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/set')) return Response.json({ ok: true });
      uploads += 1;
      return uploads === 1
        ? Response.json({ ok: false, error: 'Server busy' }, { status: 503 })
        : Response.json({ ok: true }, { status: 201 });
    });
    vi.stubGlobal('fetch', fetch);
    const { onClose, onNotice } = renderPicker();
    await options();
    fireEvent.click(startButton());
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't upload an image: Server busy The new game is set up; retry to send its images.",
    );
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Keep scores' }).disabled).toBe(
      true,
    );
    const retry = screen.getByRole('button', { name: 'Retry images' });
    fireEvent.click(retry);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/rooms/WXYZ/set',
      `/api/rooms/WXYZ/images/${imageId}`,
      `/api/rooms/WXYZ/images/${imageId}`,
    ]);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('on 409 says a new game is already set up and closes', async () => {
    const { release } = stubPut(409);
    const { onClose, onNotice } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(startButton());
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onNotice).toHaveBeenCalledWith(NEW_GAME_TAKEN_MESSAGE);
    expect(NEW_GAME_TAKEN_MESSAGE).toBe('A new game has already been set up.');
  });

  it('closes when another device starts the next game while this one is only looking', async () => {
    const { onClose, setPhase } = renderPicker();
    await options();
    expect(onClose).not.toHaveBeenCalled();
    setPhase('LOBBY');
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel and Esc close it', async () => {
    const { onClose } = renderPicker();
    await options();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
