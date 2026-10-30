// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBuiltInSets } from '../lib/builtInSets.js';
import { serveSeededBuiltIns } from '../test/builtIns.js';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { Phase, QuestionSet } from '../../../shared/types.js';
import { NEW_GAME_TAKEN_MESSAGE } from '../lib/api.js';
import { addImage, db, saveSet } from '../lib/db.js';
import { DIFFICULTY_LABELS } from '../lib/setLabels.js';
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
  serveSeededBuiltIns();
  vi.spyOn(Date, 'now').mockReturnValue(FIRST_VISIT);
  await db.delete();
  await db.open();
  // This browser's own sets; the built-ins are listed after them, from the bundle.
  await saveSet(roundTwo, FIRST_VISIT + 1);
  await saveSet(draft, FIRST_VISIT + 2);
});

afterEach(() => {
  resetBuiltInSets();
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

function renderPicker(phase: Phase = 'FINAL', preview = false, builder = false) {
  const onClose = vi.fn();
  const onNotice = vi.fn();
  const props = { code: 'WXYZ', hostToken: 'token-1', onClose, onNotice, preview, builder };
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
      ...STARTER_SETS.map(
        (set) => `${set.title}15 questions · ${DIFFICULTY_LABELS[set.difficulty!]} · Built-in`,
      ),
    ]);
    expect(radios[0]!.checked).toBe(true);
  });

  it("lists the server's built-ins after this browser's sets, without the sample when it is hidden", async () => {
    const server: QuestionSet = { ...STARTER_SETS[3]!, id: 'server-quiz', title: 'Server quiz' };
    resetBuiltInSets({ sets: [server], sampleHidden: true });
    renderPicker();
    const radios = await options();
    expect(radios.map((radio) => radio.closest('label')!.textContent)).toEqual([
      'Half done0 questions · Not playable yet',
      'Round two1 question',
      'Server quiz15 questions · Easy · Built-in',
    ]);
  });

  it("when the built-ins fail to load, lists this browser's sets with Retry, which adds them", async () => {
    resetBuiltInSets();
    const fetch = vi.fn(async () => Response.json({ error: 'Down' }, { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    renderPicker();
    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load the built-in sets.");
    expect((await options()).map((radio) => radio.closest('label')!.textContent)).toEqual([
      'Half done0 questions · Not playable yet',
      'Round two1 question',
    ]);
    expect(startButton().disabled).toBe(false);

    fetch.mockImplementation(async () =>
      Response.json({ sets: [STARTER_SETS[0]], sampleHidden: false }),
    );
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(async () => expect(await options()).toHaveLength(4));
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    // The pick made before stays picked.
    expect((await options())[0]!.checked).toBe(true);
  });

  it('a My set and a built-in with the same id both list, and the built-in one is sent', async () => {
    const twin: QuestionSet = { ...STARTER_SETS[3]!, id: roundTwo.id, title: 'Server twin' };
    resetBuiltInSets({ sets: [twin], sampleHidden: true });
    const { fetch, release } = stubPut();
    renderPicker();
    const radios = await options();
    expect(radios.map((radio) => radio.value)).toEqual([
      `mine:${draft.id}`,
      `mine:${roundTwo.id}`,
      `built-in:${roundTwo.id}`,
    ]);
    fireEvent.click(radios[2]!);
    expect(radios[1]!.checked).toBe(false);
    fireEvent.click(startButton());
    release();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(putBody(fetch).set.title).toBe('Server twin');
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

  it('puts Cancel, Keep scores, then the search box first in tab order after the heading (LND-04)', async () => {
    renderPicker();
    await options();
    const order = [...dialog().querySelectorAll<HTMLElement>('input, button')].filter(
      (element) => !(element as HTMLInputElement).disabled,
    );
    expect(order.slice(0, 3)).toEqual([
      within(dialog()).getByRole('button', { name: 'Cancel' }),
      within(dialog()).getByRole('checkbox', { name: 'Keep scores' }),
      within(dialog()).getByRole('searchbox', { name: 'Search sets' }),
    ]);
  });

  it('scrolls as a whole, list included, and widens to two panes at lg (LND-06)', async () => {
    renderPicker();
    await options();
    expect(dialog().className).toContain('overflow-y-auto');
    expect(dialog().className).toContain('lg:max-w-5xl');
    const radio = within(dialog()).getAllByRole('radio')[0]!;
    for (let el = radio.parentElement; el && el !== dialog(); el = el.parentElement) {
      expect(el.className).not.toMatch(/overflow-y-auto|max-h-/);
    }
    const summary = within(dialog()).getByRole('complementary', { name: 'Picked set' });
    expect(within(summary).getByRole('button', { name: 'Start new game' })).toBeTruthy();
    const keep = within(dialog()).getByRole('checkbox', { name: 'Keep scores' });
    expect(keep.closest('label')!.className).toContain('min-h-11');
  });

  it('picks Animals – Easy by search and chip, and sends it', async () => {
    const { fetch, release } = stubPut();
    const { onClose } = renderPicker();
    await options();
    const search = within(dialog()).getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'animal' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Easy' }));
    fireEvent.keyDown(search, { key: 'Enter' });
    expect((await options()).map((radio) => radio.checked)).toEqual([true]);
    fireEvent.click(startButton());
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putBody(fetch).set.id).toBe('starter-animals-easy');
  });

  it('locks the search box and chips while the new game is set up', async () => {
    const { release } = stubPut();
    const { onClose } = renderPicker();
    fireEvent.click((await options())[1]!);
    fireEvent.click(startButton());
    const search = within(dialog()).getByRole<HTMLInputElement>('searchbox');
    await waitFor(() => expect(search.disabled).toBe(true));
    expect(within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Hard' }).disabled).toBe(
      true,
    );
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
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

  it('offers no Preview on the Screen, which never passes `preview`', async () => {
    renderPicker();
    await options();
    expect(within(dialog()).queryAllByRole('button', { name: /^Preview/ })).toEqual([]);
    expect(screen.queryByText('Answer:', { exact: false })).toBeNull();
  });

  it("on the remote, Preview shows the picked set's answers, and Start new game in it sends it", async () => {
    const { fetch, release } = stubPut();
    const { onClose } = renderPicker('FINAL', true);
    const radios = await options();
    expect(within(dialog()).getAllByRole('button', { name: /^Preview/ })).toHaveLength(1);
    fireEvent.click(radios[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Round two' }));
    const preview = screen.getByRole('dialog', { name: 'Round two' });
    expect(within(preview).getByRole('listitem', { name: 'Question 1' }).textContent).toBe(
      'Question 1 · 100 pointsWhat?Answer: Yes',
    );
    fireEvent.click(within(preview).getByRole('button', { name: 'Start new game' }));
    expect(screen.queryByRole('dialog', { name: 'Round two' })).toBeNull();
    release();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putBody(fetch).set.title).toBe('Round two');
  });

  it('Esc in a preview closes only the preview', async () => {
    const { onClose } = renderPicker('FINAL', true);
    fireEvent.click((await options())[1]!);
    const opener = screen.getByRole('button', { name: 'Preview Round two' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Round two' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Preview Round two' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe('Build a game', () => {
    const change = (name: string, value: string) =>
      fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });

    /**
     * Every question under Other, as one built game: the built-in sample's ten, pictures included,
     * and Round two's one. Asking for more than there are takes them all, so the draw is fixed.
     */
    async function buildFromSample() {
      await options();
      fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
      change('Category, row 1', 'Other');
      change('Questions, row 1', '15');
      expect(screen.getByText('Total: 11 questions')).toBeTruthy();
    }

    it('is offered only with `builder` (the remote), not on the Screen', async () => {
      renderPicker();
      await options();
      expect(screen.queryByRole('button', { name: 'Build a game' })).toBeNull();
      cleanup();
      renderPicker('FINAL', true, true);
      await options();
      expect(screen.getByRole('button', { name: 'Build a game' })).toBeTruthy();
    });

    it('Start new game sends the built game with Keep scores and its pictures from the bundle', async () => {
      const fetch = vi.fn(async (url: string) =>
        url.endsWith('/set')
          ? Response.json({ ok: true })
          : Response.json({ ok: true }, { status: 201 }),
      );
      vi.stubGlobal('fetch', fetch);
      const { onClose } = renderPicker('FINAL', true, true);
      await buildFromSample();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Keep scores' }));
      fireEvent.click(startButton());
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

      const body = putBody(fetch);
      expect(body.keepScores).toBe(true);
      expect(body.set).toMatchObject({ title: 'Mixed: Other', category: 'Mixed' });
      expect(body.set.questions).toHaveLength(11);
      expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
        '/api/rooms/WXYZ/images/sample-img-flag',
        '/api/rooms/WXYZ/images/sample-img-hexagon',
        '/api/rooms/WXYZ/set',
      ]);
    });

    it('after a built game’s image fails to upload, Retry images sends only its images', async () => {
      let uploads = 0;
      const fetch = vi.fn(async (url: string) => {
        if (url.endsWith('/set')) return Response.json({ ok: true });
        uploads += 1;
        return uploads === 1
          ? Response.json({ ok: false, error: 'Server busy' }, { status: 503 })
          : Response.json({ ok: true }, { status: 201 });
      });
      vi.stubGlobal('fetch', fetch);
      const { onClose } = renderPicker('FINAL', true, true);
      await buildFromSample();
      fireEvent.click(startButton());
      expect((await screen.findByRole('alert')).textContent).toBe(
        "Couldn't upload an image: Server busy The new game is set up; retry to send its images.",
      );
      fireEvent.click(screen.getByRole('button', { name: 'Retry images' }));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      const urls = fetch.mock.calls.map(([url]) => url);
      expect(urls.filter((url) => url.endsWith('/set'))).toHaveLength(1);
      expect(urls.filter((url) => url.includes('/images/'))).toHaveLength(1 + 2);
    });

    it('Save to My sets puts the game first in the list, picked', async () => {
      renderPicker('FINAL', true, true);
      await options();
      fireEvent.click(screen.getByRole('button', { name: 'Build a game' }));
      change('Questions, row 1', '3');
      fireEvent.click(screen.getByRole('button', { name: 'Save to My sets' }));
      await waitFor(async () => {
        const first = (await options())[0]!;
        expect(first.closest('label')!.textContent).toBe('Mixed: Animals3 questions');
        expect(first.checked).toBe(true);
      });
    });
  });
});
