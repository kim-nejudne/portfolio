// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AVATARS,
  DEFAULT_SETTINGS,
  PLAYER_PALETTE,
  SCOREBOARD_EVERY_MAX,
  SCORE_DELTA_MAX,
  TEAMS,
} from '../../../shared/constants.js';
import type { Ack, HostView, Phase, TeamCount, TeamView } from '../../../shared/types.js';
import { resetRoomStore, useRoomStore } from '../lib/roomStore.js';
import { useHostCommand, type SendHost } from '../lib/useHostCommand.js';
import { HostPlayers } from './HostPlayers.js';
import { HostSettings } from './HostSettings.js';
import { SecondaryActions } from './SecondaryActions.js';

afterEach(cleanup);

type Sent = { event: string; payload: unknown; ack: (res: Ack) => void };

function player(n: number, overrides: Partial<HostView['players'][number]> = {}) {
  return {
    id: `p${n}`,
    name: `Player ${n}`,
    color: PLAYER_PALETTE[n]!,
    score: 0,
    connected: true,
    rank: 1,
    rttMs: 30,
    ...overrides,
  };
}

/** Question 2 of 5, worth 200, with two players. */
function hostView(overrides: Partial<HostView> = {}): HostView {
  return {
    role: 'host',
    code: 'WXYZ',
    title: 'Quiz',
    phase: 'QUESTION',
    questionIndex: 1,
    questionCount: 5,
    openingCounter: 0,
    players: [player(1), player(2)],
    winnerId: null,
    alsoBuzzed: [],
    lockedOut: [],
    falseStarts: [],
    session: null,
    teams: null,
    board: null,
    choice: null,
    typed: null,
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    question: { id: 'q2', text: 'Q2', answer: 'A2', points: 200 },
    nextQuestion: null,
    buzzes: [],
    judgements: [],
    canJudge: false,
    canUndo: false,
    canChangeTeams: true,
    scorerId: null,
    answerTimer: null,
    buzzTimer: null,
    ...overrides,
  };
}

type Panel = typeof SecondaryActions;

/**
 * Renders `Panel` with `view` and the remote's real command lock; `rerender` swaps in a new
 * snapshot as the server would.
 */
function setup(Panel: Panel, view: HostView) {
  const sent: Sent[] = [];
  const send = vi.fn<SendHost>((event, payload, ack) => void sent.push({ event, payload, ack }));
  const onRejected = vi.fn<(error: string) => void>();
  function Harness({ view }: { view: HostView }) {
    return <Panel view={view} command={useHostCommand(view, send, onRejected)} />;
  }
  const result = render(<Harness view={view} />);
  const rerender = (next: HostView) => result.rerender(<Harness view={next} />);
  return { sent, onRejected, rerender };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const isDisabled = (name: string | RegExp) => (button(name) as HTMLButtonElement).disabled;

describe('SecondaryActions', () => {
  const labels = () =>
    within(screen.getByRole('region', { name: 'More actions' }))
      .getAllByRole('button')
      // A tile shows a short label and is named by the full one.
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);

  it.each<[Phase, string[]]>([
    ['LOBBY', ['Show scoreboard', 'End game']],
    [
      'QUESTION',
      ['Skip question', 'Undo last judgement', 'Previous question', 'Show scoreboard', 'End game'],
    ],
    [
      'BUZZED',
      ['Skip question', 'Undo last judgement', 'Previous question', 'Show scoreboard', 'End game'],
    ],
    ['REVEAL', ['Undo last judgement', 'Previous question', 'Show scoreboard', 'End game']],
    ['FINAL', ['Show scoreboard']],
  ])('in %s offers %j', (phase, expected) => {
    setup(SecondaryActions, hostView({ phase }));
    expect(labels()).toEqual(expected);
  });

  it.each([
    ['Skip question', 'host:reveal', {}],
    ['Previous question', 'host:prev', {}],
    ['Show scoreboard', 'host:scoreboard', { show: true }],
  ])('%s sends %s', (label, event, payload) => {
    const { sent } = setup(SecondaryActions, hostView());
    fireEvent.click(button(label));
    expect(sent).toMatchObject([{ event, payload }]);
  });

  it('Hide scoreboard sends show false while the scoreboard is up', () => {
    const { sent } = setup(SecondaryActions, hostView({ showScoreboard: true }));
    expect(button('Hide scoreboard').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('Hide scoreboard'));
    expect(sent).toMatchObject([{ event: 'host:scoreboard', payload: { show: false } }]);
  });

  it('Undo follows canUndo from the view and sends host:undo', () => {
    const { sent, rerender } = setup(SecondaryActions, hostView({ phase: 'REVEAL' }));
    expect(isDisabled('Undo last judgement')).toBe(true);
    rerender(hostView({ phase: 'REVEAL', canUndo: true }));
    fireEvent.click(button('Undo last judgement'));
    expect(sent).toMatchObject([{ event: 'host:undo', payload: {} }]);
  });

  it('Previous question is disabled on the first question', () => {
    setup(SecondaryActions, hostView({ questionIndex: 0 }));
    expect(isDisabled('Previous question')).toBe(true);
  });

  it('End game needs a second tap, and Cancel backs out', () => {
    const { sent } = setup(SecondaryActions, hostView());
    fireEvent.click(button('End game'));
    expect(sent).toEqual([]);
    fireEvent.click(button('Cancel'));
    expect(button('End game')).toBeTruthy();
    fireEvent.click(button('End game'));
    fireEvent.click(button('Confirm end'));
    expect(sent).toMatchObject([{ event: 'host:end', payload: {} }]);
  });

  it('End game reads as destructive before it is armed, and its Cancel does not (FND-07)', () => {
    setup(SecondaryActions, hostView());
    expect(button('End game').className).toContain('text-buzz');
    expect(button('Show scoreboard').className).not.toContain('text-buzz');
    fireEvent.click(button('End game'));
    expect(button('Cancel').className).not.toContain('text-buzz');
  });

  it('sends once on a double tap; a new snapshot enables the buttons again', () => {
    const { sent, rerender } = setup(SecondaryActions, hostView());
    fireEvent.click(button('Skip question'));
    fireEvent.click(button('Show scoreboard'));
    expect(sent).toHaveLength(1);
    rerender(hostView({ phase: 'REVEAL' }));
    expect(isDisabled('Show scoreboard')).toBe(false);
  });

  it('End game sits in its own row under the tiles, and arming it moves no tile (HST-03)', () => {
    setup(SecondaryActions, hostView());
    const tiles = button('Skip question').parentElement!;
    const before = [...tiles.children];
    expect(tiles.contains(button('End game'))).toBe(false);
    fireEvent.click(button('End game'));
    expect([...tiles.children]).toEqual(before);
    expect(tiles.contains(button('Confirm end'))).toBe(false);
    expect(tiles.contains(button('Cancel'))).toBe(false);
  });

  it.each<[Phase, number]>([
    ['LOBBY', 1],
    ['QUESTION', 4],
    ['REVEAL', 3],
  ])('in %s the %i tiles share one row equally, leaving no empty cell', (phase, count) => {
    setup(SecondaryActions, hostView({ phase }));
    const tiles = button(
      phase === 'LOBBY' ? 'Show scoreboard' : 'Undo last judgement',
    ).parentElement!;
    expect(tiles.children).toHaveLength(count);
    expect(tiles.className).not.toContain('grid');
    for (const tile of tiles.children) expect(tile.className).toContain('flex-1 basis-0');
  });

  it('End game disarms when the game moves on', () => {
    const { rerender } = setup(SecondaryActions, hostView());
    fireEvent.click(button('End game'));
    rerender(hostView({ phase: 'OPEN' }));
    expect(screen.queryByRole('button', { name: 'Confirm end' })).toBeNull();
    expect(button('End game')).toBeTruthy();
  });

  it('a rejection reports the error and enables the buttons again', () => {
    const { sent, onRejected } = setup(SecondaryActions, hostView());
    fireEvent.click(button('Previous question'));
    act(() => sent[0]!.ack({ ok: false, error: 'Already on the first question' }));
    expect(onRejected).toHaveBeenCalledWith('Already on the first question');
    expect(isDisabled('Previous question')).toBe(false);
  });
});

describe('HostPlayers', () => {
  const row = (name: string) => screen.getByRole('listitem', { name });
  const nameLine = (name: string) => within(row(name)).getByText(name).closest('p')!;
  const openMenu = (name: string) => {
    fireEvent.click(button(`More for ${name}`));
    return screen.getByRole('menu', { name: `More for ${name}` });
  };

  // The remote's own socket is up unless a test says otherwise.
  beforeEach(() => useRoomStore.setState({ connection: 'connected' }));
  afterEach(resetRoomStore);

  it('shows each score and connection: online with a rounded round trip, or offline', () => {
    setup(
      HostPlayers,
      hostView({
        players: [player(1, { score: 400, rttMs: 0.368 }), player(2, { connected: false })],
      }),
    );
    expect(row('Player 1').textContent).toContain('online · 0 ms');
    expect(row('Player 1').textContent).toContain('400');
    expect(row('Player 2').textContent).toContain('offline');
  });

  it('shows the avatar beside the name, and nothing for a player without one', () => {
    setup(HostPlayers, hostView({ players: [player(1, { avatar: AVATARS[9] }), player(2)] }));
    const avatar = (name: string) => nameLine(name).querySelector('[data-avatar]');
    expect(avatar('Player 1')?.textContent).toBe(AVATARS[9]);
    expect(avatar('Player 2')).toBeNull();
  });

  it('greys out a disconnected player, who stays in the list, while their buttons stay usable', () => {
    setup(HostPlayers, hostView({ players: [player(1), player(2, { connected: false })] }));
    expect(nameLine('Player 1').className).not.toContain('opacity-40');
    expect(nameLine('Player 2').className).toContain('opacity-40');
    const more = within(row('Player 2')).getByRole('button', { name: 'More for Player 2' });
    expect(more.closest('.opacity-40')).toBeNull();
    expect(within(row('Player 2')).getByText('offline').closest('.opacity-40')).not.toBeNull();
  });

  it.each(['connecting', 'offline'] as const)(
    'while the remote itself is %s, every row says "status unknown", dimmed',
    (connection) => {
      useRoomStore.setState({ connection });
      setup(HostPlayers, hostView({ players: [player(1), player(2, { connected: false })] }));
      for (const name of ['Player 1', 'Player 2']) {
        expect(row(name).textContent).toContain('status unknown');
        expect(row(name).textContent).not.toMatch(/online|offline/);
        expect(nameLine(name).className).toContain('opacity-40');
      }
    },
  );

  it('shows the statuses again once the remote reconnects', () => {
    useRoomStore.setState({ connection: 'offline' });
    setup(HostPlayers, hostView({ players: [player(1, { rttMs: 12 })] }));
    act(() => useRoomStore.setState({ connection: 'connected' }));
    expect(row('Player 1').textContent).toContain('online · 12 ms');
    expect(nameLine('Player 1').className).not.toContain('opacity-40');
  });

  it.each([
    ['Add 200 to Player 2', 200],
    ['Subtract 200 from Player 2', -200],
  ])('%s sends host:adjustScore by the question value', (label, delta) => {
    const { sent } = setup(HostPlayers, hostView());
    expect(within(row('Player 2')).getByRole('button', { name: label }).textContent).toBe(
      delta > 0 ? '+200' : '−200',
    );
    fireEvent.click(button(label));
    expect(sent).toMatchObject([{ event: 'host:adjustScore', payload: { playerId: 'p2', delta } }]);
  });

  it('hides the question-value buttons when there is no current question', () => {
    setup(HostPlayers, hostView({ phase: 'LOBBY', questionIndex: -1, question: null }));
    expect(screen.queryByRole('button', { name: /^(Add|Subtract) \d/ })).toBeNull();
    expect(button('More for Player 1')).toBeTruthy();
  });

  describe('Custom', () => {
    const custom = (name: string) => button(`Custom amount for ${name}`);
    const fieldNamed = (name: string) =>
      screen.getByRole('textbox', { name: `Amount for ${name}` }) as HTMLInputElement;
    const type = (name: string, value: string) =>
      fireEvent.change(fieldNamed(name), { target: { value } });

    it('opens an amount field for that player only', () => {
      setup(HostPlayers, hostView());
      expect(custom('Player 2').getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(custom('Player 2'));
      expect(custom('Player 2').getAttribute('aria-expanded')).toBe('true');
      expect(fieldNamed('Player 2')).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: 'Amount for Player 1' })).toBeNull();
    });

    it.each([
      ['Add', 750],
      ['Subtract', -750],
    ])('%s sends host:adjustScore by the typed amount and closes the field', (verb, delta) => {
      const { sent } = setup(HostPlayers, hostView());
      fireEvent.click(custom('Player 2'));
      type('Player 2', '750');
      const name = verb === 'Add' ? 'Add 750 to Player 2' : 'Subtract 750 from Player 2';
      const action = within(row('Player 2'))
        .getAllByRole('button', { name })
        .find((b) => b.textContent !== '+200' && b.textContent !== '−200')!;
      expect(action.textContent).toBe(delta > 0 ? '+750' : '−750');
      fireEvent.click(action);
      expect(sent).toMatchObject([
        { event: 'host:adjustScore', payload: { playerId: 'p2', delta } },
      ]);
      expect(screen.queryByRole('textbox', { name: 'Amount for Player 2' })).toBeNull();
    });

    it('accepts the largest allowed amount', () => {
      const { sent } = setup(HostPlayers, hostView());
      fireEvent.click(custom('Player 1'));
      type('Player 1', String(SCORE_DELTA_MAX));
      fireEvent.click(button(`Subtract ${SCORE_DELTA_MAX} from Player 1`));
      expect(sent).toMatchObject([
        { event: 'host:adjustScore', payload: { playerId: 'p1', delta: -SCORE_DELTA_MAX } },
      ]);
    });

    it.each(['', '0', '-5', '2.5', 'abc', String(SCORE_DELTA_MAX + 1)])(
      'keeps Add and Subtract disabled for %j',
      (value) => {
        const { sent } = setup(HostPlayers, hostView());
        fireEvent.click(custom('Player 1'));
        type('Player 1', value);
        const actions = within(row('Player 1'))
          .getAllByRole('button', { name: /custom amount (to|from) Player 1$/ })
          .map((b) => (b as HTMLButtonElement).disabled);
        expect(actions).toEqual([true, true]);
        expect(sent).toEqual([]);
      },
    );

    it('works without a current question, in the lobby', () => {
      const { sent } = setup(
        HostPlayers,
        hostView({ phase: 'LOBBY', questionIndex: -1, question: null }),
      );
      fireEvent.click(custom('Player 1'));
      type('Player 1', ' 40 ');
      fireEvent.click(button('Add 40 to Player 1'));
      expect(sent).toMatchObject([
        { event: 'host:adjustScore', payload: { playerId: 'p1', delta: 40 } },
      ]);
    });
  });

  it("Kick is in the row's ⋯ menu, never beside a score button (HST-04)", () => {
    setup(HostPlayers, hostView());
    expect(within(row('Player 2')).queryByRole('button', { name: /Kick/ })).toBeNull();
    const line = within(row('Player 2')).getByRole('button', {
      name: 'Add 200 to Player 2',
    }).parentElement!;
    expect(line.lastElementChild!.textContent).toBe('⋯');
  });

  it('Kick through the menu needs a second press on that player, then sends host:kick', () => {
    const { sent } = setup(HostPlayers, hostView());
    const menu = openMenu('Player 2');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Kick' }));
    expect(sent).toEqual([]);
    expect(within(row('Player 1')).queryByRole('menuitem', { name: 'Confirm kick' })).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Confirm kick' }));
    expect(sent).toMatchObject([{ event: 'host:kick', payload: { playerId: 'p2' } }]);
  });

  it("Kick is the menu's last item and reads as destructive before it is armed (FND-07)", () => {
    setup(HostPlayers, hostView());
    const items = within(openMenu('Player 2')).getAllByRole('menuitem');
    expect(items.at(-1)!.textContent).toBe('Kick');
    expect(items.at(-1)!.className).toContain('text-buzz');
    fireEvent.click(items.at(-1)!);
    expect(
      within(row('Player 2')).getByRole('menuitem', { name: 'Cancel' }).className,
    ).not.toContain('text-buzz');
  });

  it('shows a long name whole, on up to two lines, not cut to one (HST-04)', () => {
    setup(HostPlayers, hostView({ players: [player(1, { name: 'Bartholomew Jones' })] }));
    const name = within(row('Bartholomew Jones')).getByText('Bartholomew Jones');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).not.toContain('truncate');
  });

  it('a kicked player leaves the list with the next snapshot', () => {
    const { rerender } = setup(HostPlayers, hostView());
    rerender(hostView({ players: [player(1)] }));
    expect(screen.getByRole('region', { name: 'Players (1)' })).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: 'Player 2' })).toBeNull();
  });
});

describe('HostSettings', () => {
  const toggle = (name: RegExp) => screen.getByRole('switch', { name });
  const every = () => screen.getByRole('status', { name: 'Scoreboard every' });

  it('shows the room’s settings: defaults off, every 5 and standings on', () => {
    setup(HostSettings, hostView());
    expect(toggle(/^Wrong-answer penalty/).getAttribute('aria-checked')).toBe('false');
    expect(toggle(/^Auto-open buzzers/).getAttribute('aria-checked')).toBe('false');
    expect(every().textContent).toBe('5');
    expect(toggle(/^Standings on the Screen/).getAttribute('aria-checked')).toBe('true');
  });

  it.each([
    [/^Wrong-answer penalty/, { wrongPenalty: true }],
    [/^Auto-open buzzers/, { autoOpenBuzzers: true }],
    [/^Standings on the Screen/, { showStandings: false }],
  ])('switch %s sends only its own key', (name, payload) => {
    const { sent } = setup(HostSettings, hostView());
    fireEvent.click(toggle(name));
    expect(sent).toEqual([expect.objectContaining({ event: 'host:settings', payload })]);
  });

  it('a switch that is on sends false', () => {
    const { sent } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, wrongPenalty: true } }),
    );
    fireEvent.click(toggle(/^Wrong-answer penalty/));
    expect(sent[0]?.payload).toEqual({ wrongPenalty: false });
  });

  it.each(['Presets', 'Answer time', 'Scoreboard every', 'Phone and Screen language'])(
    'the %s row is a size container that stacks its controls when narrow (HST-05)',
    (label) => {
      setup(HostSettings, hostView());
      const box = screen.getByText(label).closest('.\\@container')!;
      const layout = box.firstElementChild!;
      expect(layout.className).toContain('flex-col');
      expect(layout.className).toContain('@sm:flex-row');
      // The controls go under the label, on the right.
      expect(layout.lastElementChild!.className).toContain('self-end');
    },
  );

  it('the Screen lobby (compact) keeps every row on one line', () => {
    const send = vi.fn<SendHost>();
    const view = hostView({ phase: 'LOBBY' });
    function Compact() {
      return <HostSettings view={view} command={useHostCommand(view, send, vi.fn())} compact />;
    }
    render(<Compact />);
    const layout = screen.getByText('Answer time').closest('.\\@container')!.firstElementChild!;
    expect(layout.className).not.toContain('flex-col');
    expect(layout.className).toContain('items-center');
  });

  it('standings that are off show off and send true', () => {
    const { sent } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, showStandings: false } }),
    );
    expect(toggle(/^Standings on the Screen/).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle(/^Standings on the Screen/));
    expect(sent[0]?.payload).toEqual({ showStandings: true });
  });

  it.each([
    ['More questions between scoreboards', 6],
    ['Fewer questions between scoreboards', 4],
  ])('%s sends scoreboardEvery %i', (label, value) => {
    const { sent } = setup(HostSettings, hostView());
    fireEvent.click(button(label));
    expect(sent[0]).toMatchObject({ event: 'host:settings', payload: { scoreboardEvery: value } });
  });

  it('0 reads Never and stops the − button; the maximum stops the + button', () => {
    const { rerender } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, scoreboardEvery: 0 } }),
    );
    expect(every().textContent).toBe('Never');
    expect(isDisabled('Fewer questions between scoreboards')).toBe(true);
    rerender(
      hostView({ settings: { ...DEFAULT_SETTINGS, scoreboardEvery: SCOREBOARD_EVERY_MAX } }),
    );
    expect(isDisabled('More questions between scoreboards')).toBe(true);
  });

  const answerTime = () => screen.getByRole('status', { name: 'Answer time' });

  it('shows the answer time Off by default', () => {
    setup(HostSettings, hostView());
    expect(answerTime().textContent).toBe('Off');
    expect(isDisabled('Less answer time')).toBe(true);
  });

  it.each([
    [0, 'More answer time', 3],
    [3, 'More answer time', 5],
    [5, 'More answer time', 7],
    [7, 'More answer time', 10],
    [10, 'Less answer time', 7],
    [5, 'Less answer time', 3],
    [3, 'Less answer time', 0],
  ] as const)('from %i s, %s sends answerSeconds %i only', (from, label, to) => {
    const { sent } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, answerSeconds: from } }),
    );
    fireEvent.click(button(label));
    expect(sent).toEqual([
      expect.objectContaining({ event: 'host:settings', payload: { answerSeconds: to } }),
    ]);
  });

  it('reads the seconds and stops the + button at 10 s', () => {
    setup(HostSettings, hostView({ settings: { ...DEFAULT_SETTINGS, answerSeconds: 10 } }));
    expect(answerTime().textContent).toBe('10 s');
    expect(isDisabled('More answer time')).toBe(true);
    expect(isDisabled('Less answer time')).toBe(false);
  });

  const buzzTime = () => screen.getByRole('status', { name: 'Buzz time' });

  it('shows the buzz time Off by default', () => {
    setup(HostSettings, hostView());
    expect(buzzTime().textContent).toBe('Off');
    expect(isDisabled('Less buzz time')).toBe(true);
    expect(isDisabled('More buzz time')).toBe(false);
  });

  it.each([
    [0, 'More buzz time', 5],
    [5, 'More buzz time', 10],
    [10, 'More buzz time', 15],
    [15, 'More buzz time', 20],
    [20, 'More buzz time', 30],
    [30, 'Less buzz time', 20],
    [10, 'Less buzz time', 5],
    [5, 'Less buzz time', 0],
  ] as const)('from %i s, %s sends buzzSeconds %i only', (from, label, to) => {
    const { sent } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, buzzSeconds: from } }),
    );
    fireEvent.click(button(label));
    expect(sent).toEqual([
      expect.objectContaining({ event: 'host:settings', payload: { buzzSeconds: to } }),
    ]);
  });

  it('reads the buzz time and stops the + button at 30 s', () => {
    setup(HostSettings, hostView({ settings: { ...DEFAULT_SETTINGS, buzzSeconds: 30 } }));
    expect(buzzTime().textContent).toBe('30 s');
    expect(isDisabled('More buzz time')).toBe(true);
    expect(isDisabled('Less buzz time')).toBe(false);
  });

  const falseStart = () => screen.getByRole('status', { name: 'False start' });

  it('shows the false start Off by default', () => {
    setup(HostSettings, hostView());
    expect(falseStart().textContent).toBe('Off');
    expect(isDisabled('Less false start wait')).toBe(true);
    expect(isDisabled('More false start wait')).toBe(false);
  });

  it.each([
    [0, 'More false start wait', 500],
    [500, 'More false start wait', 1000],
    [1000, 'Less false start wait', 500],
    [500, 'Less false start wait', 0],
  ] as const)('from %i ms, %s sends falseStartMs %i only', (from, label, to) => {
    const { sent } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, falseStartMs: from } }),
    );
    fireEvent.click(button(label));
    expect(sent).toEqual([
      expect.objectContaining({ event: 'host:settings', payload: { falseStartMs: to } }),
    ]);
  });

  it('reads the false start as 0.5 s and 1 s, and stops the + button at 1 s', () => {
    const { rerender } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, falseStartMs: 500 } }),
    );
    expect(falseStart().textContent).toBe('0.5 s');
    rerender(hostView({ settings: { ...DEFAULT_SETTINGS, falseStartMs: 1000 } }));
    expect(falseStart().textContent).toBe('1 s');
    expect(isDisabled('More false start wait')).toBe(true);
    expect(isDisabled('Less false start wait')).toBe(false);
  });

  const party = {
    autoOpenBuzzers: true,
    wrongPenalty: false,
    answerSeconds: 0,
    buzzSeconds: 0,
    falseStartMs: 0,
  } as const;
  const competitive = {
    autoOpenBuzzers: false,
    wrongPenalty: true,
    answerSeconds: 5,
    buzzSeconds: 10,
    falseStartMs: 500,
  } as const;
  const preset = (name: string) => within(presets()).getByRole('button', { name });
  const presets = () => screen.getByRole('group', { name: 'Presets' });
  const pressed = (name: string) => preset(name).getAttribute('aria-pressed');

  it('shows the two presets above the switches', () => {
    setup(HostSettings, hostView());
    const section = screen.getByRole('region', { name: 'Settings' });
    expect(section.firstElementChild).toBe(presets());
    expect(
      within(presets())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Party', 'Competitive']);
  });

  it.each([
    ['Party', party],
    ['Competitive', competitive],
  ] as const)('%s sends one host:settings with its values', (name, payload) => {
    const { sent } = setup(HostSettings, hostView());
    fireEvent.click(preset(name));
    expect(sent).toEqual([expect.objectContaining({ event: 'host:settings', payload })]);
  });

  it('marks neither preset on the default settings', () => {
    setup(HostSettings, hostView());
    expect(pressed('Party')).toBe('false');
    expect(pressed('Competitive')).toBe('false');
  });

  it.each([
    ['Party', 'Competitive', party],
    ['Competitive', 'Party', competitive],
  ] as const)('marks %s active while the settings match it', (name, other, values) => {
    // Scoreboard and standings are not part of a preset, so other values keep the mark.
    setup(
      HostSettings,
      hostView({
        settings: { ...DEFAULT_SETTINGS, ...values, scoreboardEvery: 0, showStandings: false },
      }),
    );
    expect(pressed(name)).toBe('true');
    expect(pressed(other)).toBe('false');
  });

  it.each([
    ['Party', { ...party, autoOpenBuzzers: false }],
    ['Party', { ...party, falseStartMs: 500 }],
    ['Competitive', { ...competitive, answerSeconds: 7 }],
    ['Competitive', { ...competitive, autoOpenBuzzers: true }],
  ] as const)('drops the %s mark when one of its settings differs', (name, values) => {
    const { rerender } = setup(
      HostSettings,
      hostView({ settings: { ...DEFAULT_SETTINGS, ...values } }),
    );
    expect(pressed(name)).toBe('false');
    rerender(
      hostView({ settings: { ...DEFAULT_SETTINGS, ...(name === 'Party' ? party : competitive) } }),
    );
    expect(pressed(name)).toBe('true');
  });

  it('a preset sends nothing more until the next snapshot, which marks it', () => {
    const { sent, rerender } = setup(HostSettings, hostView());
    fireEvent.click(preset('Competitive'));
    expect(isDisabled('Party')).toBe(true);
    fireEvent.click(preset('Party'));
    expect(sent).toHaveLength(1);
    expect(pressed('Competitive')).toBe('false');
    rerender(hostView({ settings: { ...DEFAULT_SETTINGS, ...competitive } }));
    expect(isDisabled('Party')).toBe(false);
    expect(pressed('Competitive')).toBe('true');
  });

  const language = () => screen.getByRole('group', { name: 'Phone and Screen language' });
  const languageButton = (name: string) => within(language()).getByRole('button', { name });

  it('offers English and Taglish for the phones and the Screen, English marked by default (F91)', () => {
    setup(HostSettings, hostView());
    expect(
      within(language())
        .getAllByRole('button')
        .map((b) => [b.textContent, b.getAttribute('aria-pressed')]),
    ).toEqual([
      ['English', 'true'],
      ['Taglish', 'false'],
    ]);
    // The remote itself stays English whatever the room's language (F91).
    expect(screen.getByRole('region', { name: 'Settings' }).textContent).toContain(
      'Wrong-answer penalty',
    );
  });

  it('Taglish sends host:settings {copy}, and the next snapshot marks it', () => {
    const { sent, rerender } = setup(HostSettings, hostView());
    fireEvent.click(languageButton('Taglish'));
    expect(sent).toEqual([
      expect.objectContaining({ event: 'host:settings', payload: { copy: 'taglish' } }),
    ]);
    rerender(hostView({ settings: { ...DEFAULT_SETTINGS, copy: 'taglish' } }));
    expect(languageButton('Taglish').getAttribute('aria-pressed')).toBe('true');
    expect(isDisabled('Taglish')).toBe(true);
    fireEvent.click(languageButton('English'));
    expect(sent.at(-1)).toEqual(
      expect.objectContaining({ event: 'host:settings', payload: { copy: 'en' } }),
    );
  });

  it('shows the new value only once the snapshot carries it', () => {
    const { rerender } = setup(HostSettings, hostView());
    fireEvent.click(button('More questions between scoreboards'));
    expect(every().textContent).toBe('5');
    rerender(hostView({ settings: { ...DEFAULT_SETTINGS, scoreboardEvery: 6 } }));
    expect(every().textContent).toBe('6');
  });

  it('compact (the Screen lobby) keeps every control and value in tighter rows; the remote keeps its size', () => {
    const send = vi.fn<SendHost>();
    const view = hostView({
      settings: { ...DEFAULT_SETTINGS, answerSeconds: 5, falseStartMs: 500 },
    });
    function Compact() {
      return <HostSettings view={view} command={useHostCommand(view, send, vi.fn())} compact />;
    }
    render(<Compact />);
    expect(toggle(/^Wrong-answer penalty/)).toBeTruthy();
    expect(toggle(/^Auto-open buzzers/)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Answer time' }).textContent).toBe('5 s');
    expect(screen.getByRole('status', { name: 'False start' }).textContent).toBe('0.5 s');
    expect(button('More false start wait').className).toContain('size-7');
    expect(every().textContent).toBe('5');
    expect(button('More answer time').className).toContain('size-7');
    expect(toggle(/^Auto-open buzzers/).className).toContain('py-0.5');
    expect(preset('Competitive').className).toContain('h-7');
    expect(languageButton('Taglish').className).toContain('h-7');
    cleanup();

    setup(HostSettings, view);
    expect(button('More answer time').className).toContain('size-12');
    expect(toggle(/^Auto-open buzzers/).className).toContain('p-4');
  });

  it('compact keeps each detail for screen readers only, so every row is one line; the remote shows them', () => {
    const detail = () => screen.getByText('The top 5 beside each question.');
    const send = vi.fn<SendHost>();
    const view = hostView();
    function Compact() {
      return <HostSettings view={view} command={useHostCommand(view, send, vi.fn())} compact />;
    }
    render(<Compact />);
    expect(detail().className).toContain('sr-only');
    expect(toggle(/^Standings on the Screen/).textContent).toContain(
      'The top 5 beside each question.',
    );
    cleanup();

    setup(HostSettings, view);
    expect(detail().className).not.toContain('sr-only');
  });
});

/** `count` teams with the given members, in index order, as the server lists them. */
function teams(count: TeamCount, members: string[][], scores: number[] = []): TeamView[] {
  return TEAMS.slice(0, count).map((team, index) => ({
    index,
    name: team.name,
    color: team.color,
    score: scores[index] ?? 0,
    rank: 1,
    memberIds: members[index] ?? [],
  }));
}

/** Teams on: Players 1 and 3 on Red, Player 2 on Blue, in the lobby unless overridden. */
function teamView(overrides: Partial<HostView> = {}): HostView {
  return hostView({
    phase: 'LOBBY',
    questionIndex: -1,
    question: null,
    settings: { ...DEFAULT_SETTINGS, teams: 2 },
    players: [player(1, { score: 100 }), player(2), player(3, { score: 50 })],
    teams: teams(2, [['p1', 'p3'], ['p2']], [150, 0]),
    ...overrides,
  });
}

describe('HostSettings: teams stepper', () => {
  const count = () => screen.getByRole('status', { name: 'Teams' });

  it('shows Off by default, with − stopped', () => {
    setup(HostSettings, hostView({ phase: 'LOBBY' }));
    expect(count().textContent).toBe('Off');
    expect(isDisabled('Fewer teams')).toBe(true);
    expect(isDisabled('More teams')).toBe(false);
  });

  it.each<[TeamCount, string, TeamCount]>([
    [0, 'More teams', 2],
    [2, 'More teams', 3],
    [3, 'More teams', 4],
    [4, 'Fewer teams', 3],
    [3, 'Fewer teams', 2],
    [2, 'Fewer teams', 0],
  ])('from %i, %s sends only teams %i', (from, label, to) => {
    const { sent } = setup(
      HostSettings,
      hostView({ phase: 'LOBBY', settings: { ...DEFAULT_SETTINGS, teams: from } }),
    );
    fireEvent.click(button(label));
    expect(sent).toEqual([
      expect.objectContaining({ event: 'host:settings', payload: { teams: to } }),
    ]);
  });

  it('shows the count from the snapshot and stops + at 4', () => {
    setup(HostSettings, hostView({ phase: 'LOBBY', settings: { ...DEFAULT_SETTINGS, teams: 4 } }));
    expect(count().textContent).toBe('4');
    expect(isDisabled('More teams')).toBe(true);
  });

  it('is off while the view says teams cannot change, and on again when it can', () => {
    const view = { settings: { ...DEFAULT_SETTINGS, teams: 2 as const } };
    const { rerender } = setup(HostSettings, hostView({ ...view, canChangeTeams: false }));
    expect(isDisabled('More teams')).toBe(true);
    expect(isDisabled('Fewer teams')).toBe(true);
    expect(isDisabled('More answer time')).toBe(false);
    rerender(hostView({ ...view, phase: 'REVEAL', canChangeTeams: true }));
    expect(isDisabled('More teams')).toBe(false);
  });

  it('presets leave the team count alone', () => {
    const { sent } = setup(HostSettings, hostView({ phase: 'LOBBY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Party' }));
    expect(sent[0]?.payload).not.toHaveProperty('teams');
  });

  it('the Screen lobby (compact) has the stepper too', () => {
    const send = vi.fn<SendHost>();
    const view = hostView({ phase: 'LOBBY', settings: { ...DEFAULT_SETTINGS, teams: 3 } });
    function Compact() {
      return <HostSettings view={view} command={useHostCommand(view, send, vi.fn())} compact />;
    }
    render(<Compact />);
    expect(count().textContent).toBe('3');
    expect(button('More teams').className).toContain('size-7');
  });
});

describe('HostPlayers: teams', () => {
  const group = (name: RegExp) => screen.getByRole('region', { name });
  const menuItems = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }));
    return within(screen.getByRole('menu', { name: `More for ${name}` })).getAllByRole('menuitem');
  };
  const moveTo = (name: string, team: string) =>
    menuItems(name).find((item) => item.textContent === `Move to ${team}`)!;
  const names = (region: HTMLElement) =>
    within(region)
      .queryAllByRole('listitem')
      .map((li) => li.getAttribute('aria-label'));

  beforeEach(() => useRoomStore.setState({ connection: 'connected' }));
  afterEach(resetRoomStore);

  it('groups players by team in index order, members in join order', () => {
    setup(HostPlayers, teamView());
    const groups = within(screen.getByRole('region', { name: 'Players (3)' }))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(groups).toEqual(['Red2 players150', 'Blue1 player0']);
    expect(names(group(/^Red/))).toEqual(['Player 1', 'Player 3']);
    expect(names(group(/^Blue/))).toEqual(['Player 2']);
  });

  it('heads each team with its colour', () => {
    setup(HostPlayers, teamView());
    const heading = within(group(/^Blue/)).getByRole('heading');
    expect(within(heading).getByText('Blue').style.color).toBe('rgb(59, 130, 246)');
  });

  it('keeps an empty team with "No players yet"', () => {
    setup(
      HostPlayers,
      teamView({
        settings: { ...DEFAULT_SETTINGS, teams: 3 },
        teams: teams(3, [['p1', 'p3'], ['p2'], []]),
      }),
    );
    expect(within(group(/^Green/)).getByText('No players yet')).toBeTruthy();
  });

  it("each row's ⋯ menu offers a move to every other team, then Kick", () => {
    setup(
      HostPlayers,
      teamView({
        settings: { ...DEFAULT_SETTINGS, teams: 3 },
        teams: teams(3, [['p1', 'p3'], ['p2'], []]),
      }),
    );
    expect(menuItems('Player 2').map((item) => item.textContent)).toEqual([
      'Move to Red',
      'Move to Green',
      'Kick',
    ]);
  });

  it('picking a team sends host:setTeam and moves the row only with the next snapshot', () => {
    const { sent, rerender } = setup(HostPlayers, teamView());
    fireEvent.click(moveTo('Player 3', 'Blue'));
    expect(sent).toMatchObject([{ event: 'host:setTeam', payload: { playerId: 'p3', team: 1 } }]);
    expect(names(group(/^Red/))).toEqual(['Player 1', 'Player 3']);
    act(() => sent[0]!.ack({ ok: true }));
    rerender(teamView({ teams: teams(2, [['p1'], ['p2', 'p3']]) }));
    expect(names(group(/^Blue/))).toEqual(['Player 2', 'Player 3']);
    expect(moveTo('Player 3', 'Red')).toBeTruthy();
  });

  it('a refused move shows the error and leaves the player where they were', () => {
    const { sent, onRejected } = setup(HostPlayers, teamView());
    fireEvent.click(moveTo('Player 1', 'Blue'));
    act(() => sent[0]!.ack({ ok: false, error: 'No such team' }));
    expect(onRejected).toHaveBeenCalledWith('No such team');
    expect(names(group(/^Red/))).toEqual(['Player 1', 'Player 3']);
  });

  it('the moves are off while the view says teams cannot change', () => {
    const { sent } = setup(
      HostPlayers,
      teamView({
        phase: 'QUESTION',
        questionIndex: 1,
        question: { id: 'q2', text: 'Q2', answer: 'A2', points: 200 },
        canChangeTeams: false,
      }),
    );
    const move = moveTo('Player 1', 'Blue');
    expect(move.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(move);
    expect(sent).toEqual([]);
    expect(isDisabled('Add 200 to Player 1')).toBe(false);
  });

  it('with teams off there are no groups and no team moves', () => {
    setup(HostPlayers, hostView());
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(menuItems('Player 1').map((item) => item.textContent)).toEqual(['Kick']);
  });

  it('a player on no team still shows, under No team', () => {
    setup(HostPlayers, teamView({ teams: teams(2, [['p1'], ['p2']]) }));
    expect(names(group(/^No team/))).toEqual(['Player 3']);
    expect(menuItems('Player 3').map((item) => item.textContent)).toEqual([
      'Move to Red',
      'Move to Blue',
      'Kick',
    ]);
  });
});
