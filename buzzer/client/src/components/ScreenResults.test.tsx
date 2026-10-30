// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_PALETTE, TEAMS } from '../../../shared/constants.js';
import type { RankedPlayer, RankedTotal, SessionView, TeamView } from '../../../shared/types.js';
import { pureWidthSizes, textSizesWithoutFloor } from '../test/screenSizes.js';
import { FinalResults, rankingColumns, Scoreboard, TONIGHT_ROWS } from './ScreenResults.js';

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

function team(index: number, score: number, rank: number, memberIds: string[] = []): TeamView {
  return { index, ...TEAMS[index]!, score, rank, memberIds };
}

describe('FinalResults with teams', () => {
  const players = [
    player(1, 'Ana', 300, 1),
    player(2, 'Ben', 200, 2),
    player(3, 'Cy', 100, 3),
    player(4, 'Dee', 0, 4),
  ];
  // Index order, as the views send them: Red 300, Blue 300, Green 0, Yellow 100.
  const teams = [
    team(0, 300, 1, ['p1']),
    team(1, 300, 1, ['p2', 'p3']),
    team(2, 0, 4),
    team(3, 100, 3, ['p4']),
  ];
  const podium = () => screen.getByRole('region', { name: 'Team podium' });
  const teamSteps = () =>
    [...podium().querySelectorAll(':scope > ol > li')].map((step) => {
      const names = [...step.querySelectorAll('ul > li')].map((li) => li.textContent);
      return `${step.getAttribute('aria-label')}: ${names.join(', ')}`;
    });

  it('stands the teams on the podium by rank, tied teams sharing a step', () => {
    render(<FinalResults players={players} teams={teams} />);
    expect(screen.queryByRole('region', { name: 'Podium' })).toBeNull();
    expect(teamSteps()).toEqual(['3rd place: Yellow', '1st place: Red, Blue']);
  });

  it('names a team ranked below 3rd under the podium', () => {
    render(<FinalResults players={players} teams={teams} />);
    expect(within(podium()).getByText('4th Green 0')).toBeTruthy();
  });

  it('shows each team in its colour with its summed score on the step', () => {
    render(<FinalResults players={players} teams={[team(0, 500, 1, ['p1', 'p2'])]} />);
    const name = within(podium()).getByText('Red');
    const probe = document.createElement('span');
    probe.style.backgroundColor = TEAMS[0].color;
    expect(name.style.backgroundColor).toBe(probe.style.backgroundColor);
    expect(within(podium()).getByText('500')).toBeTruthy();
  });

  it('then ranks the players in the full ranking', () => {
    render(<FinalResults players={players} teams={teams} />);
    const ranking = screen.getByRole('region', { name: 'Full ranking' });
    expect([...ranking.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '1Ana300',
      '2Ben200',
      '3Cy100',
      '4Dee0',
    ]);
  });
});

describe('Scoreboard with teams', () => {
  const players = [player(1, 'Ana', 300, 1), player(2, 'Ben', 100, 2), player(3, 'Cy', 0, 3)];
  const board = () => screen.getByRole('region', { name: 'Scoreboard' });
  const rowsOf = (name: string) =>
    within(within(board()).getByRole('list', { name }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  it('ranks the teams first, then the players', () => {
    render(
      <Scoreboard
        players={players}
        lastOrder={[]}
        onShown={() => {}}
        teams={[team(0, 100, 2, ['p2', 'p3']), team(1, 300, 1, ['p1'])]}
      />,
    );
    expect(rowsOf('Teams')).toEqual(['1Blue300', '2Red100']);
    const lists = within(board()).getAllByRole('list');
    expect(lists[0]!.getAttribute('aria-label')).toBe('Teams');
    expect(
      within(lists[1]!)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1Ana300', '2Ben100', '3Cy0']);
  });

  it('with teams off lists only the players', () => {
    render(<Scoreboard players={players} lastOrder={[]} onShown={() => {}} />);
    expect(within(board()).queryByRole('list', { name: 'Teams' })).toBeNull();
    expect(within(board()).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('legibility on any display (F100)', () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) => player((i % 8) + 1, `P${i}`, 0, i + 1));
  const ranking = (region: string) =>
    screen.getByRole('region', { name: region }).querySelector<HTMLOListElement>('ol')!;
  function tonightOf(count: number): SessionView {
    const totals = many(count).map(({ id, name, color, score, rank }) => ({
      id,
      name,
      color,
      total: score,
      rank,
    }));
    return { gameNumber: 2, totals };
  }

  it.each([
    [6, 1],
    [7, 2],
    [10, 2],
    [16, 2],
    [24, 3],
    [30, 3],
    [50, 4],
  ])('ranks %i players in %i columns, so 24 stay at 24px or more at 1080p', (count, columns) => {
    expect(rankingColumns(count)).toBe(columns);
  });

  it('beside the Tonight card keeps a ranking of 10 in one column', () => {
    render(<FinalResults players={many(10)} session={tonightOf(3)} />);
    expect(ranking('Full ranking').style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
  });

  it('gives the ranking the card’s remaining height, with rows as tall as their content, so its fit can measure them', () => {
    render(<Scoreboard players={many(24)} lastOrder={[]} onShown={() => {}} />);
    const list = screen.getByRole('region', { name: 'Scoreboard' }).querySelector('ol')!;
    expect(list.className).toContain('flex-1');
    expect(list.className).toContain('overflow-hidden');
    expect(list.style.gridTemplateRows).toBe('repeat(8, auto)');
    expect(list.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it.each([
    [
      'the scoreboard',
      () => render(<Scoreboard players={many(10)} lastOrder={[]} onShown={() => {}} />),
    ],
    [
      'the scoreboard with teams',
      () =>
        render(
          <Scoreboard
            players={many(4)}
            lastOrder={[]}
            onShown={() => {}}
            teams={[0, 1].map((index) => ({
              index,
              ...TEAMS[index]!,
              score: 0,
              rank: 1,
              memberIds: [],
            }))}
          />,
        ),
    ],
    ['the Final screen', () => render(<FinalResults players={many(12)} session={tonightOf(12)} />)],
    ['an empty Final screen', () => render(<FinalResults players={[]} />)],
  ])('every text size on %s has a floor, and none grows with the width alone', (_, show) => {
    show();
    expect(textSizesWithoutFloor(document.body)).toEqual([]);
    expect(pureWidthSizes(document.body)).toEqual([]);
  });

  it('stacks the Final screen in portrait: podium, ranking, then Tonight', () => {
    render(<FinalResults players={many(3)} session={tonightOf(3)} />);
    const podium = screen.getByRole('region', { name: 'Podium' });
    const root = podium.parentElement!;
    expect(root.className).toContain('stage-portrait:flex-col');
    expect([...root.children].map((el) => el.getAttribute('aria-label'))).toEqual([
      'Podium',
      'Full ranking',
      'Tonight',
    ]);
  });

  it('widens the podium steps and lowers them in portrait', () => {
    render(<FinalResults players={many(3)} />);
    const step = screen.getByRole('listitem', { name: '1st place' });
    expect(step.className).toContain('stage-portrait:max-w-[30vw]');
    expect(step.querySelector('[data-winner]')!.className).toContain('stage-portrait:h-[16vh]');
  });
});
