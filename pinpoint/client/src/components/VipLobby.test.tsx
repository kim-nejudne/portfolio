// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CategorySummary, GameSettings, PlayerView } from '#shared/types.js';
import { FakeSocket } from '../test/fakeSocket.js';
import { VipLobby, type VipPlayerView } from './VipLobby.js';

const BOX = { south: 0, west: 0, north: 10, east: 10 };
function category(id: string, name: string, counts: CategorySummary['counts']): CategorySummary {
  return { id, name, emoji: '🌍', box: BOX, labelStyle: 'city', counts };
}
const full = { city: 30, landmark: 30 };
const WORLD = category('world', 'World', { easy: full, medium: full, hard: full });
const ALPS = category('alps', 'Alps', { easy: full, medium: full, hard: full });
const JAPAN = category('japan', 'Japan', {
  easy: { city: 20, landmark: 0 },
  medium: { city: 20, landmark: 0 },
  hard: { city: 8, landmark: 0 },
});
const DEFAULTS: GameSettings = {
  categoryId: '',
  mode: 'name',
  difficulty: 'mixed',
  rounds: 10,
  timerSeconds: 30,
};

function view({
  settings = {},
  categories = [ALPS, WORLD, JAPAN],
  screenCount = 1,
}: {
  settings?: Partial<GameSettings>;
  categories?: CategorySummary[];
  screenCount?: number;
} = {}): VipPlayerView {
  const s = { ...DEFAULTS, ...settings };
  const me = {
    ...{ id: 'p1', name: 'Ana', emoji: '🐸', color: '#56B4E9', connected: true, waiting: false },
    ...{ isVip: true, total: 0, rank: 1 },
  };
  return {
    role: 'player',
    serverNow: 0,
    code: 'WXYZ',
    phase: 'LOBBY',
    me,
    playerCount: 1,
    vipName: 'Ana',
    settings: s,
    categoryName: categories.find((c) => c.id === s.categoryId)?.name ?? null,
    hasCategories: categories.length > 0,
    paused: null,
    rematchAt: null,
    region: null,
    round: null,
    myResult: null,
    final: null,
    vip: { categories, screenCount, players: [me], controls: ['start', 'kick'] },
  } satisfies PlayerView;
}

let socket: FakeSocket;
function renderLobby(v: VipPlayerView) {
  const result = render(<VipLobby view={v} socket={socket.asSocket()} />);
  return {
    rerender: (next: VipPlayerView) =>
      result.rerender(<VipLobby view={next} socket={socket.asSocket()} />),
  };
}
const sent = (event: string) =>
  socket.emitted.filter((e) => e.event === event).map((e) => e.payload);
const pressed = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);
const option = (group: string, label: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', {
    name: label,
  }) as HTMLButtonElement;
const start = () => screen.getByRole('button', { name: 'Start ▶' }) as HTMLButtonElement;

beforeEach(() => {
  socket = new FakeSocket();
  localStorage.clear();
});
afterEach(cleanup);

describe('VipLobby', () => {
  it('picks World first for a fresh room and shows the default settings', () => {
    renderLobby(view());
    expect(sent('vip:settings')).toEqual([{ categoryId: 'world' }]);
    expect(pressed('Mode')).toEqual(['Name']);
    expect(pressed('Difficulty')).toEqual(['Mixed']);
    expect(pressed('Rounds')).toEqual(['10']);
    expect(pressed('Timer')).toEqual(['30 s']);
  });

  it('takes the first category by name when there is no World', () => {
    renderLobby(view({ categories: [JAPAN, ALPS] }));
    expect(sent('vip:settings')).toEqual([{ categoryId: 'alps' }]);
  });

  it("applies the VIP's remembered settings to the next room, and remembers new ones", () => {
    localStorage.setItem(
      'pinpoint:vipSettings',
      JSON.stringify({
        categoryId: 'alps',
        mode: 'picture',
        difficulty: 'hard',
        rounds: 5,
        timerSeconds: 45,
      }),
    );
    const { rerender } = renderLobby(view());
    expect(sent('vip:settings')).toEqual([
      { categoryId: 'alps', mode: 'picture', difficulty: 'hard', rounds: 5, timerSeconds: 45 },
    ]);
    rerender(view({ settings: { categoryId: 'japan', rounds: 15 } }));
    expect(JSON.parse(localStorage.getItem('pinpoint:vipSettings')!)).toEqual({
      ...DEFAULTS,
      categoryId: 'japan',
      rounds: 15,
    });
  });

  it('ignores a remembered category that no longer exists and junk values', () => {
    localStorage.setItem(
      'pinpoint:vipSettings',
      JSON.stringify({ categoryId: 'atlantis', timerSeconds: 45, rounds: 7, mode: 'sound' }),
    );
    renderLobby(view());
    expect(sent('vip:settings')).toEqual([{ categoryId: 'world', timerSeconds: 45 }]);
  });

  it('leaves a room that already has a live category as it is', () => {
    renderLobby(view({ settings: { categoryId: 'japan' } }));
    expect(sent('vip:settings')).toEqual([]);
  });

  it('sends each tap as vip:settings and shows a refusal', () => {
    renderLobby(view({ settings: { categoryId: 'world' } }));
    fireEvent.click(screen.getByRole('button', { name: /Alps/ }));
    fireEvent.click(option('Mode', 'Picture'));
    fireEvent.click(option('Timer', '45 s'));
    expect(sent('vip:settings')).toEqual([
      { categoryId: 'alps' },
      { mode: 'picture' },
      { timerSeconds: 45 },
    ]);
    act(() => socket.emitted[0]!.ack({ ok: false, error: 'That category is not available' }));
    expect(screen.getByRole('alert').textContent).toBe('That category is not available');
  });

  it('greys unavailable combinations with the reason', () => {
    renderLobby(view({ settings: { categoryId: 'japan', difficulty: 'hard' } }));
    expect(screen.getByRole('button', { name: /Japan/ }).textContent).toContain(
      'Easy 20 · Medium 20 · Hard 8',
    );
    // Hard has 8 cities: 5 rounds fit, 10 and 15 do not.
    expect(option('Rounds', '5').disabled).toBe(false);
    expect(option('Rounds', '10').disabled).toBe(true);
    expect(option('Rounds', '15').disabled).toBe(true);
    const rounds = within(screen.getByRole('group', { name: 'Rounds' }));
    expect(rounds.getByText('Japan · Hard has 8 cities; this game needs 10.')).toBeTruthy();
    expect(rounds.getByText('Japan · Hard has 8 cities; this game needs 15.')).toBeTruthy();
    expect(start().disabled).toBe(true);
    expect(start().getAttribute('aria-describedby')).toBe('start-reason');
    expect(document.getElementById('start-reason')!.textContent).toBe(
      'Japan · Hard has 8 cities; this game needs 10.',
    );
  });

  it('greys a category, a level and Mixed without enough places in the mode', () => {
    renderLobby(view({ settings: { categoryId: 'japan', mode: 'picture' } }));
    const japan = screen.getByRole('button', { name: /Japan/ }) as HTMLButtonElement;
    expect(japan.disabled).toBe(true);
    expect(japan.textContent).toContain('Not enough landmarks yet');
    for (const level of ['Easy', 'Medium', 'Hard', 'Mixed']) {
      expect(option('Difficulty', level).disabled).toBe(true);
    }
    const difficulty = within(screen.getByRole('group', { name: 'Difficulty' }));
    expect(difficulty.getByText('Japan · Easy has 0 landmarks; this game needs 5.')).toBeTruthy();
    expect(difficulty.getByText('Japan · Easy has 0 landmarks; this game needs 2.')).toBeTruthy();
  });

  it('disables Start with the reason, and starts once every check passes', () => {
    const { rerender } = renderLobby(view({ screenCount: 0, settings: { categoryId: 'world' } }));
    expect(start().disabled).toBe(true);
    expect(screen.getByText('Open the Screen first')).toBeTruthy();
    rerender(view({ settings: { categoryId: 'gone' } }));
    expect(screen.getByText('Pick a category')).toBeTruthy();
    rerender(view({ settings: { categoryId: 'world' } }));
    expect(start().disabled).toBe(false);
    fireEvent.click(start());
    expect(sent('vip:start')).toEqual([{}]);
  });

  it('shows the empty state with no live category', () => {
    renderLobby(view({ categories: [] }));
    const card = screen.getByRole('group', { name: 'Category' });
    expect(card.textContent).toContain('No destinations yet. Check back soon.');
    expect(start().disabled).toBe(true);
    expect(screen.getAllByText('No destinations yet. Check back soon.')).toHaveLength(2);
    expect(sent('vip:settings')).toEqual([]);
  });

  it('adds a search box over 8 categories that filters by name', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      category(`c${i}`, i === 4 ? 'Japan' : `Region ${i}`, { easy: full }),
    );
    renderLobby(view({ categories: many, settings: { categoryId: 'c0' } }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search categories' }), {
      target: { value: 'jap' },
    });
    const cards = within(screen.getByRole('group', { name: 'Category' })).getAllByRole('listitem');
    expect(cards.map((c) => c.textContent)).toEqual([expect.stringContaining('Japan')]);
  });

  it('has no search box with 8 categories or fewer', () => {
    renderLobby(view({ settings: { categoryId: 'world' } }));
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
