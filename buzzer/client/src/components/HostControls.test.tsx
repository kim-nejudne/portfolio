// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  PLAYER_PALETTE,
  SCOREBOARD_EVERY_MAX,
} from '../../../shared/constants.js';
import type { Ack, HostView, Phase } from '../../../shared/types.js';
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
    showScoreboard: false,
    settings: DEFAULT_SETTINGS,
    question: { id: 'q2', text: 'Q2', answer: 'A2', points: 200 },
    nextQuestion: null,
    buzzes: [],
    judgements: [],
    canJudge: false,
    canUndo: false,
    scorerId: null,
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
      .map((b) => b.textContent);

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

  it('sends once on a double tap; a new snapshot enables the buttons again', () => {
    const { sent, rerender } = setup(SecondaryActions, hostView());
    fireEvent.click(button('Skip question'));
    fireEvent.click(button('Show scoreboard'));
    expect(sent).toHaveLength(1);
    rerender(hostView({ phase: 'REVEAL' }));
    expect(isDisabled('Show scoreboard')).toBe(false);
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

  it('greys out a disconnected player, who stays in the list, while their buttons stay usable', () => {
    setup(HostPlayers, hostView({ players: [player(1), player(2, { connected: false })] }));
    const nameLine = (name: string) => within(row(name)).getByText(name).parentElement!;
    expect(nameLine('Player 1').className).not.toContain('opacity-40');
    expect(nameLine('Player 2').className).toContain('opacity-40');
    const kick = within(row('Player 2')).getByRole('button', { name: /Kick/ });
    expect(kick.closest('.opacity-40')).toBeNull();
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

  it('hides the adjust buttons when there is no current question', () => {
    setup(HostPlayers, hostView({ phase: 'LOBBY', questionIndex: -1, question: null }));
    expect(screen.queryByRole('button', { name: /^Add/ })).toBeNull();
    expect(button('Kick Player 1')).toBeTruthy();
  });

  it('Kick needs a second tap on that player, then sends host:kick', () => {
    const { sent } = setup(HostPlayers, hostView());
    fireEvent.click(button('Kick Player 2'));
    expect(sent).toEqual([]);
    expect(within(row('Player 1')).queryByRole('button', { name: 'Confirm kick' })).toBeNull();
    fireEvent.click(within(row('Player 2')).getByRole('button', { name: 'Confirm kick' }));
    expect(sent).toMatchObject([{ event: 'host:kick', payload: { playerId: 'p2' } }]);
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

  it('shows the room’s settings: defaults off and every 5', () => {
    setup(HostSettings, hostView());
    expect(toggle(/^Wrong-answer penalty/).getAttribute('aria-checked')).toBe('false');
    expect(toggle(/^Auto-open buzzers/).getAttribute('aria-checked')).toBe('false');
    expect(every().textContent).toBe('5');
  });

  it.each([
    [/^Wrong-answer penalty/, { wrongPenalty: true }],
    [/^Auto-open buzzers/, { autoOpenBuzzers: true }],
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

  it('shows the new value only once the snapshot carries it', () => {
    const { rerender } = setup(HostSettings, hostView());
    fireEvent.click(button('More questions between scoreboards'));
    expect(every().textContent).toBe('5');
    rerender(hostView({ settings: { ...DEFAULT_SETTINGS, scoreboardEvery: 6 } }));
    expect(every().textContent).toBe('6');
  });
});
