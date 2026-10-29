// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { RankedPlayer } from '../../../shared/types.js';
import { FinalResults } from './ScreenResults.js';

afterEach(cleanup);

function player(n: number, name: string, score: number, rank: number): RankedPlayer {
  const color = PLAYER_PALETTE[n - 1]!;
  return { id: `p${n}`, name, color, score, connected: true, rank };
}

/** The podium's step list (not the name lists inside each step): it centres whatever steps it has. */
const stepList = () =>
  screen.getByRole('region', { name: 'Podium' }).querySelector<HTMLOListElement>(':scope > ol')!;

/** The podium's steps, left to right, as "<place>: <names>". */
function steps(): string[] {
  return [...stepList().children].map((step) => {
    const names = [...step.querySelectorAll('ul > li')].map((li) => li.textContent);
    return `${step.getAttribute('aria-label')}: ${names.join(', ')}`;
  });
}

describe('FinalResults podium', () => {
  it('with one player shows only their step, centred', () => {
    render(<FinalResults players={[player(1, 'Ana', 300, 1)]} />);
    expect(steps()).toEqual(['1st place: Ana']);
    expect(stepList().className).toContain('justify-center');
  });

  it('with two players shows only their two steps, second then first, centred', () => {
    render(<FinalResults players={[player(1, 'Ana', 300, 1), player(2, 'Ben', 100, 2)]} />);
    expect(steps()).toEqual(['2nd place: Ben', '1st place: Ana']);
    expect(stepList().className).toContain('justify-center');
  });

  it('with two tied players shows one shared step and no empty one', () => {
    render(<FinalResults players={[player(1, 'Ana', 200, 1), player(2, 'Ben', 200, 1)]} />);
    expect(steps()).toEqual(['1st place: Ana, Ben']);
  });

  it('with three players fills all three steps', () => {
    render(
      <FinalResults
        players={[player(1, 'Ana', 300, 1), player(2, 'Ben', 200, 2), player(3, 'Cy', 100, 3)]}
      />,
    );
    expect(steps()).toEqual(['2nd place: Ben', '1st place: Ana', '3rd place: Cy']);
  });
});

describe('FinalResults full ranking', () => {
  const ranking = () =>
    screen.getByRole('region', { name: 'Full ranking' }).querySelector<HTMLOListElement>('ol')!;
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => player((i % 8) + 1, `P${i}`, 0, 1));

  // jsdom has no layout: the shrinkable tracks are what keep a wide row (avatar, long name) from
  // pushing its score past the card's edge, as the F75 playtest found at 1920×1080.
  it.each([
    [3, 1],
    [12, 2],
    [30, 3],
  ])('with %i players uses %i columns that may shrink below their content', (count, columns) => {
    render(<FinalResults players={many(count)} />);
    expect(ranking().style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
  });
});
