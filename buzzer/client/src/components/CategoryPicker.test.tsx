// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_SET } from '../../../shared/sampleSet.js';
import { STARTER_SETS } from '../../../shared/starterSets/index.js';
import type { QuestionSet } from '../../../shared/types.js';
import { pickerSections } from '../lib/categoryCards.js';
import { setDetail } from '../lib/setLabels.js';
import { CategoryPicker } from './CategoryPicker.js';

afterEach(cleanup);

const mySet: QuestionSet = { ...SAMPLE_SET, id: 'mine-1', title: 'Friday office quiz' };
const keyOf = (set: QuestionSet) => (set === mySet ? `mine:${set.id}` : `built-in:${set.id}`);

/** The picker over `builtIn`, holding its own pick like the pickers do. */
function renderPicker({
  mine = [mySet],
  builtIn = [SAMPLE_SET, ...STARTER_SETS.slice(0, 6)],
  first = null as string | null,
  onBuild = undefined as (() => void) | undefined,
} = {}) {
  const onSelect = vi.fn();
  const sections = pickerSections(mine, builtIn, {}, keyOf);
  function Harness() {
    const [key, setKey] = useState<string | null>(first);
    return (
      <CategoryPicker
        id="t"
        sections={sections}
        selectedKey={key}
        onSelect={(next) => {
          onSelect(next);
          setKey(next);
        }}
        detail={(set) => setDetail(set, false)}
        onBuild={onBuild}
      />
    );
  }
  render(<Harness />);
  return { onSelect };
}

const checkedName = () =>
  screen
    .getAllByRole<HTMLInputElement>('radio')
    .find((radio) => radio.checked)
    ?.getAttribute('aria-label') ?? null;

describe('CategoryPicker', () => {
  it('every level and tile is a native radio of one group, named by its set title', () => {
    renderPicker();
    const radios = screen.getAllByRole<HTMLInputElement>('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      mySet.title,
      SAMPLE_SET.title,
      ...STARTER_SETS.slice(0, 6).map((set) => set.title),
    ]);
    // One name, so the browser's arrow keys move between every level and tile.
    expect(new Set(radios.map((radio) => radio.name))).toEqual(new Set(['t-set']));
    expect(radios.every((radio) => radio.type === 'radio')).toBe(true);
  });

  it("a click on a card's body picks Medium at first, then the level last chosen", () => {
    renderPicker();
    fireEvent.click(screen.getByText('Movies'));
    expect(checkedName()).toBe('Movies – Medium');
    fireEvent.click(screen.getByRole('radio', { name: 'Animals – Hard' }));
    fireEvent.click(screen.getByText('Movies'));
    expect(checkedName()).toBe('Movies – Hard');
  });

  it('a click on a level picks that level, not the last one', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'Animals – Easy' }));
    expect(checkedName()).toBe('Animals – Easy');
  });

  it('a level the category lacks is no radio, and the body picks the nearest one it has', () => {
    renderPicker({ builtIn: [STARTER_SETS[0]!, STARTER_SETS[2]!] });
    const card = screen.getByRole('group', { name: 'Animals' });
    expect(within(card).getAllByRole('radio')).toHaveLength(2);
    expect(card.textContent).toContain('M');
    fireEvent.click(within(card).getByText('Animals'));
    expect(checkedName()).toBe('Animals – Easy');
  });

  it("while disabled, a click on a card's body picks nothing", () => {
    const sections = pickerSections([], STARTER_SETS.slice(0, 3), {}, keyOf);
    const onSelect = vi.fn();
    render(
      <CategoryPicker
        id="t"
        sections={sections}
        selectedKey={null}
        onSelect={onSelect}
        detail={(set) => setDetail(set, false)}
        disabled
      />,
    );
    fireEvent.click(screen.getByText('Animals'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Animals – Easy' }).matches(':disabled')).toBe(true);
  });

  it('a tile is picked by a click anywhere on it', () => {
    renderPicker();
    fireEvent.click(screen.getByText('🎲'));
    expect(checkedName()).toBe(SAMPLE_SET.title);
  });

  it('the pick has the gold ring and a check badge; nothing else is gold', () => {
    renderPicker({ first: 'built-in:starter-animals-medium' });
    const animals = screen.getByRole('group', { name: 'Animals' });
    const movies = screen.getByRole('group', { name: 'Movies' });
    expect(animals.className).toContain('border-accent');
    expect(animals.querySelector('.animate-check-pop')).toBeTruthy();
    expect(movies.className).not.toContain('border-accent');
    expect(movies.querySelector('.animate-check-pop')).toBeNull();
  });

  it('the lift, tilt and check badge stay under 250 ms and are off under reduced motion', () => {
    renderPicker({ first: 'built-in:starter-animals-medium' });
    const animals = screen.getByRole('group', { name: 'Animals' });
    expect(animals.className).toContain('duration-200');
    expect(animals.className).toContain('motion-safe:hover:-translate-y-0.5');
    expect(animals.className).toContain('motion-reduce:transition-none');
    const emoji = within(animals).getByText('🐾');
    expect(emoji.className).toContain('motion-safe:group-hover/item:-rotate-4');
    expect(emoji.className).toContain('motion-reduce:transition-none');
    expect(animals.querySelector('.animate-check-pop')!.className).toContain(
      'motion-reduce:animate-none',
    );
  });

  it('Enter in the search picks the one tile left, or the one card at its level', () => {
    renderPicker();
    const search = screen.getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'office' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(checkedName()).toBe(mySet.title);
    fireEvent.change(search, { target: { value: 'movies' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(checkedName()).toBe('Movies – Medium');
  });

  it('Enter does nothing while more than one card or tile is left', () => {
    const { onSelect } = renderPicker();
    const search = screen.getByRole('searchbox', { name: 'Search sets' });
    fireEvent.change(search, { target: { value: 'a' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a search that hides the pick clears it, and says when nothing matches', () => {
    const { onSelect } = renderPicker({ first: 'mine:mine-1' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sets' }), {
      target: { value: 'zzz' },
    });
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(screen.getByRole('status').textContent).toBe('No sets match.');
    expect(screen.queryByRole('group', { name: 'Your sets' })).toBeNull();
  });

  it('Build a game is the last tile only when `onBuild` is passed', () => {
    renderPicker();
    expect(screen.queryByRole('button', { name: 'Build a game' })).toBeNull();
    cleanup();
    const onBuild = vi.fn();
    renderPicker({ onBuild });
    const build = screen.getByRole('button', { name: 'Build a game' });
    expect(build.parentElement!.lastElementChild).toBe(build);
    fireEvent.click(build);
    expect(onBuild).toHaveBeenCalledOnce();
  });

  it('Your sets and Built-in show their counts', () => {
    renderPicker();
    expect(screen.getByRole('group', { name: 'Your sets' }).textContent).toContain('1');
    // The sample tile and the two categories' cards.
    const builtIn = screen.getByRole('group', { name: 'Built-in' });
    expect(builtIn.querySelector('h3')!.nextElementSibling!.textContent).toBe('3');
  });
});
