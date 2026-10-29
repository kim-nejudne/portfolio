// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_PALETTE } from '../../../shared/constants.js';
import type { RankedPlayer, RankedTotal, SessionView } from '../../../shared/types.js';
import { FinalResults, TONIGHT_ROWS } from './ScreenResults.js';

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

describe('FinalResults Tonight panel', () => {
  function total(n: number, name: string, value: number, rank: number): RankedTotal {
    return { id: `p${n}`, name, color: PLAYER_PALETTE[n - 1]!, total: value, rank };
  }
  const tonight = () => screen.queryByRole('region', { name: 'Tonight' });
  const rows = (region: HTMLElement) => [...region.querySelectorAll('li')];

  it('is absent in game 1', () => {
    render(<FinalResults players={[player(1, 'Ana', 300, 1)]} session={null} />);
    expect(tonight()).toBeNull();
  });

  it('ranks the night totals beside the game ranking, a player who left dimmed', () => {
    const session: SessionView = {
      gameNumber: 2,
      totals: [total(2, 'Ben', 500, 1), total(3, 'Cy', 400, 2), total(1, 'Ana', 400, 2)],
    };
    // Cy left during game 2: still in the night, gone from this game.
    render(
      <FinalResults
        players={[player(1, 'Ana', 300, 1), player(2, 'Ben', 100, 2)]}
        session={session}
      />,
    );
    const panel = tonight()!;
    expect(rows(panel).map((li) => li.textContent)).toEqual(['1Ben500', '2Cy400', '2Ana400']);
    expect(rows(panel).map((li) => li.className.includes('opacity-40'))).toEqual([
      false,
      true,
      false,
    ]);
    // The game's own ranking still shows this game's scores.
    const game = screen.getByRole('region', { name: 'Full ranking' });
    expect(rows(game).map((li) => li.textContent)).toEqual(['1Ana300', '2Ben100']);
  });

  it(`lists the top ${TONIGHT_ROWS} and counts the rest`, () => {
    const totals = Array.from({ length: 13 }, (_, i) =>
      total((i % 8) + 1, `T${i}`, 100 - i, i + 1),
    );
    render(<FinalResults players={[player(1, 'Ana', 0, 1)]} session={{ gameNumber: 3, totals }} />);
    const panel = tonight()!;
    expect(rows(panel)).toHaveLength(TONIGHT_ROWS);
    expect(within(panel).getByText('and 3 more')).toBeTruthy();
  });
});
