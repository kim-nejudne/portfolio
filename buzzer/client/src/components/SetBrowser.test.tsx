// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import type { QuestionSet } from '../../../shared/types.js';
import { NO_CATEGORY } from '../lib/setFilter.js';
import { SetBrowser } from './SetBrowser.js';

afterEach(cleanup);

/** A picker over the built-ins that keeps its own selection, as HostGame does. */
function Picker({ initial = BUILT_IN_SETS[0]!.id, disabled = false }) {
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  return (
    <>
      <SetBrowser
        mode="select"
        id="test"
        legend="Question set"
        sets={BUILT_IN_SETS}
        selectedId={selectedId}
        onSelect={setSelectedId}
        detail={(set) => `${set.questions.length} questions`}
        disabled={disabled}
      />
      <p data-testid="selected">{selectedId ?? 'none'}</p>
    </>
  );
}

const search = () => screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search sets' });
const chip = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
const radioTitles = () =>
  screen
    .queryAllByRole<HTMLInputElement>('radio')
    .map((radio) => radio.closest('label')!.querySelector('.line-clamp-2')!.textContent);
const selected = () => screen.getByTestId('selected').textContent;
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });

/** The elements Tab reaches, in document order (nothing here sets a positive tabIndex). */
function tabbable(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('input, button, a[href]')].filter(
    (element) => !(element as HTMLInputElement).disabled && element.tabIndex >= 0,
  );
}

describe('SetBrowser picker', () => {
  it('puts the search box first in tab order, before the chips and the sets', () => {
    const { container } = render(<Picker />);
    const order = tabbable(container);
    expect(order[0]).toBe(search());
    expect(order.slice(1, 5).map((b) => b.textContent)).toEqual(['Easy', 'Medium', 'Hard', 'None']);
  });

  it('groups the sets by category, the sample under Other first', () => {
    render(<Picker />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      NO_CATEGORY,
      ...new Set(BUILT_IN_SETS.slice(1).map((s) => s.category!)),
    ]);
    const animals = within(screen.getByRole('group', { name: 'Animals' }));
    expect(animals.getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual([
      'Animals – Easy15 questions',
      'Animals – Medium15 questions',
      'Animals – Hard15 questions',
    ]);
  });

  it('typing "animal" and choosing Easy leaves one set', () => {
    render(<Picker />);
    type('animal');
    fireEvent.click(chip('Easy'));
    expect(chip('Easy').getAttribute('aria-pressed')).toBe('true');
    expect(radioTitles()).toEqual(['Animals – Easy']);
  });

  it('"anim" at Easy leaves Animals and Anime & Manga (DECISIONS F55)', () => {
    render(<Picker />);
    type('anim');
    fireEvent.click(chip('Easy'));
    expect(radioTitles()).toEqual(['Animals – Easy', 'Anime & Manga – Easy']);
  });

  it('chips add up, and a second press turns one off', () => {
    render(<Picker />);
    type('science');
    fireEvent.click(chip('Easy'));
    fireEvent.click(chip('Hard'));
    expect(radioTitles()).toEqual(['Science – Easy', 'Science – Hard']);
    fireEvent.click(chip('Easy'));
    expect(chip('Easy').getAttribute('aria-pressed')).toBe('false');
    expect(radioTitles()).toEqual(['Science – Hard']);
  });

  it('None keeps the sets without a difficulty', () => {
    render(<Picker />);
    fireEvent.click(chip('None'));
    expect(radioTitles()).toEqual([BUILT_IN_SETS[0]!.title]);
  });

  it('Enter in the search box selects the one set left', () => {
    render(<Picker />);
    type('animal');
    fireEvent.click(chip('Easy'));
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(selected()).toBe('starter-animals-easy');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Animals – Easy/ }).checked).toBe(
      true,
    );
  });

  it('Enter does nothing while more than one set is left', () => {
    render(<Picker initial="starter-animals-hard" />);
    type('animals');
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(selected()).toBe('starter-animals-hard');
  });

  it('hiding the selected set clears the selection; showing it again does not restore it', () => {
    render(<Picker />);
    expect(selected()).toBe(BUILT_IN_SETS[0]!.id);
    type('movies');
    expect(selected()).toBe('none');
    type('');
    expect(selected()).toBe('none');
  });

  it('keeps the selection while the selected set stays in view', () => {
    render(<Picker initial="starter-movies-easy" />);
    type('movie');
    fireEvent.click(chip('Easy'));
    expect(selected()).toBe('starter-movies-easy');
  });

  it('says so when nothing matches', () => {
    render(<Picker />);
    type('zzz');
    expect(screen.getByRole('status').textContent).toBe('No sets match.');
    expect(radioTitles()).toEqual([]);
  });

  it('matches without accents', () => {
    const sets: QuestionSet[] = [
      { id: 'p', title: 'Pokémon', questions: [], createdAt: 1, updatedAt: 1, schemaVersion: 1 },
    ];
    render(
      <SetBrowser
        mode="select"
        id="accents"
        legend="Question set"
        sets={sets}
        selectedId={null}
        onSelect={() => {}}
        detail={() => ''}
      />,
    );
    type('POKEMON');
    expect(radioTitles()).toEqual(['Pokémon']);
  });

  it('lays the sets out as a container-query grid with no scroll box of its own (LND-02)', () => {
    render(<Picker />);
    const animals = screen.getByRole('group', { name: 'Animals' });
    const grid = animals.querySelector('h3 + div')!;
    expect(grid.className).toContain('@md:grid-cols-2');
    expect(grid.className).toContain('@2xl:grid-cols-3');
    const container = grid.closest('.\\@container')!;
    expect(container).toBeTruthy();
    for (let el: Element | null = grid; el && el !== document.body; el = el.parentElement) {
      expect(el.className).not.toMatch(/overflow-y-auto|max-h-/);
    }
  });

  it('wraps a title onto a second line instead of cutting it short (LND-02)', () => {
    render(<Picker />);
    const title = screen
      .getByRole('radio', { name: /^Animals – Easy/ })
      .closest('label')!
      .querySelector('.line-clamp-2')!;
    expect(title.textContent).toBe('Animals – Easy');
    expect(screen.getByRole('group', { name: 'Animals' }).querySelector('.truncate')).toBeNull();
  });

  it('disabled locks the search box, the chips and the sets', () => {
    render(<Picker disabled />);
    expect(search().disabled).toBe(true);
    expect(chip('Easy').disabled).toBe(true);
    expect(
      screen.getAllByRole<HTMLInputElement>('radio').every((r) => r.matches(':disabled')),
    ).toBe(true);
  });
});

describe('SetBrowser cards', () => {
  function renderCards() {
    render(
      <SetBrowser
        mode="actions"
        id="cards"
        sets={BUILT_IN_SETS}
        detail={(set) => `${set.questions.length} questions`}
        actions={(set) => (
          <>
            <button type="button">Copy {set.title}</button>
            <button type="button">Host {set.title}</button>
          </>
        )}
      />,
    );
  }

  it('shows a card per set under its category heading', () => {
    renderCards();
    const animals = within(screen.getByRole('region', { name: 'Animals' }));
    expect(animals.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Animals – Easy',
      'Animals – Medium',
      'Animals – Hard',
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(BUILT_IN_SETS.length);
  });

  it('Enter on the one set left moves focus to its first action', () => {
    renderCards();
    type('animal');
    fireEvent.click(chip('Easy'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Copy Animals – Easy' }),
    );
  });
});
