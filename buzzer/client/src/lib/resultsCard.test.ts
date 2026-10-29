// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayerView, RankedPlayer, RankedTotal, SessionView } from '../../../shared/types.js';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardDate,
  cardFromPlayer,
  cardFromRoom,
  cardLayout,
  drawResultsCard,
  NAMES_TOP,
  shareOrDownload,
  type CardContext,
  type ResultsCardInput,
} from './resultsCard.js';

const DATE = new Date(2026, 9, 29, 21, 30);

function player(i: number, score: number, rank: number, extra: Partial<RankedPlayer> = {}) {
  return {
    id: `p${i}`,
    name: `Player ${i}`,
    color: '#EF4444',
    score,
    connected: true,
    rank,
    ...extra,
  } satisfies RankedPlayer;
}

/** `n` players with falling scores, ranked 1..n. */
function players(n: number): RankedPlayer[] {
  return Array.from({ length: n }, (_, i) => player(i + 1, 100 * (n - i), i + 1));
}

function total(i: number, value: number, rank: number): RankedTotal {
  return { id: `p${i}`, name: `Player ${i}`, color: '#22C55E', total: value, rank };
}

function room(n: number, session: SessionView | null = null) {
  return { code: 'WXYZ', title: 'Pub Quiz', players: players(n), session };
}

/** A context that records every string drawn, measuring 20px per character. */
function recorder() {
  const drawn: string[] = [];
  const at = new Map<string, number>();
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    fillRect: vi.fn(),
    fillText: (value: string, _x: number, y: number) => {
      drawn.push(value);
      // The first place drawn: a podium name before its ranking row.
      if (!at.has(value)) at.set(value, y);
    },
    measureText: (value: string) => ({ width: [...value].length * 20 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  } as unknown as CardContext & { fillRect: ReturnType<typeof vi.fn> };
  return { ctx, drawn, at };
}

function draw(input: ResultsCardInput): string[] {
  const { ctx, drawn } = recorder();
  drawResultsCard(ctx, input);
  return drawn;
}

describe('cardLayout', () => {
  it('puts the top three ranks on the podium, ties sharing a step, second first third', () => {
    const view = {
      ...room(0),
      players: [player(1, 300, 1), player(2, 300, 1), player(3, 100, 3), player(4, 50, 4)],
    };
    const { podium } = cardLayout(cardFromRoom(view, DATE));
    expect(podium.map((s) => [s.rank, s.players.map((p) => p.id)])).toEqual([
      // The second step (here rank 3) stands left of the first.
      [3, ['p3']],
      [1, ['p1', 'p2']],
    ]);
  });

  it('cuts the ranking to the top 10 and counts the rest', () => {
    const { ranking } = cardLayout(cardFromRoom(room(13), DATE));
    expect(ranking.rows.map((r) => r.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `p${i + 1}`),
    );
    expect(ranking.more).toBe(3);
    expect(cardLayout(cardFromRoom(room(10), DATE)).ranking.more).toBe(0);
  });

  it('orders the remote’s join-order list by rank, ties kept in join order', () => {
    const view = { ...room(0), players: [player(1, 0, 3), player(2, 50, 1), player(3, 50, 1)] };
    expect(cardLayout(cardFromRoom(view, DATE)).ranking.rows.map((r) => r.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ]);
  });

  it('has the night only from game 2, cut to its top 10', () => {
    expect(cardLayout(cardFromRoom(room(3), DATE)).tonight).toBeNull();
    const totals = Array.from({ length: 12 }, (_, i) => total(i + 1, 1000 - i, i + 1));
    const { tonight } = cardLayout(cardFromRoom(room(3, { gameNumber: 2, totals }), DATE));
    expect(tonight?.rows).toHaveLength(10);
    expect(tonight?.rows[0]).toMatchObject({ id: 'p1', points: 1000, rank: 1 });
    expect(tonight?.more).toBe(2);
  });

  it('takes the phone’s results, counting players beyond its top 10', () => {
    const view = {
      results: {
        title: 'Movie Night',
        ranking: { rows: players(10), count: 14 },
        tonight: { rows: [total(1, 700, 1)], count: 1 },
      },
    } as PlayerView;
    const layout = cardLayout(cardFromPlayer(view, DATE)!);
    expect(layout.ranking.more).toBe(4);
    expect(layout.tonight).toEqual({ rows: [expect.objectContaining({ points: 700 })], more: 0 });
    expect(cardFromPlayer({ results: null } as PlayerView, DATE)).toBeNull();
  });
});

describe('drawResultsCard', () => {
  it('fills a 1080 × 1350 card', () => {
    const { ctx } = recorder();
    drawResultsCard(ctx, cardFromRoom(room(3), DATE));
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, CARD_WIDTH, CARD_HEIGHT);
    expect([CARD_WIDTH, CARD_HEIGHT]).toEqual([1080, 1350]);
  });

  it('draws the logo, set title, date, podium and the full ranking', () => {
    const drawn = draw(cardFromRoom(room(3), DATE));
    expect(drawn).toEqual(
      expect.arrayContaining(['Buzzr', 'Pub Quiz', '29 October 2026', 'Full ranking']),
    );
    // Each podium step's place and score, then the ranking rows.
    expect(drawn.filter((t) => t === '1st')).toHaveLength(2);
    expect(drawn.filter((t) => t === 'Player 3')).toHaveLength(2);
    expect(drawn).not.toContain('Tonight');
  });

  it('draws only 10 ranking rows and "and N more"', () => {
    const drawn = draw(cardFromRoom(room(13), DATE));
    expect(drawn).toContain('Player 10');
    expect(drawn).not.toContain('Player 11');
    expect(drawn).toContain('and 3 more');
  });

  it('draws the game and the night side by side from game 2', () => {
    const session = { gameNumber: 2, totals: [total(9, 900, 1)] };
    const drawn = draw(cardFromRoom(room(2, session), DATE));
    expect(drawn).toEqual(expect.arrayContaining(['This game', 'Tonight', 'Player 9', '900']));
    expect(drawn).not.toContain('Full ranking');
  });

  it('ends a crowded tie on a step in "+N", every name clear of the date', () => {
    const view = {
      ...room(0),
      players: Array.from({ length: 12 }, (_, i) => player(i + 1, 50, 1)),
    };
    const { ctx, drawn, at } = recorder();
    drawResultsCard(ctx, cardFromRoom(view, DATE));
    // The top step has room for 2 names and "+10" under the date.
    expect(drawn).toContain('+10');
    for (const line of ['Player 1', 'Player 2', '+10']) {
      expect(at.get(line)).toBeGreaterThanOrEqual(NAMES_TOP);
    }
    expect(at.get('29 October 2026')).toBeLessThan(NAMES_TOP - 32);
  });

  it('never draws the room code', () => {
    const totals = [total(1, 400, 1)];
    for (const input of [
      cardFromRoom(room(13), DATE),
      cardFromRoom(room(3, { gameNumber: 3, totals }), DATE),
    ]) {
      expect(draw(input).join('\n')).not.toContain('WXYZ');
    }
    expect(JSON.stringify(cardFromRoom(room(3), DATE))).not.toContain('WXYZ');
  });

  it('puts the avatar before the name and cuts a long title with an ellipsis', () => {
    const view = {
      ...room(0),
      title: 'A'.repeat(60),
      players: [player(1, 10, 1, { avatar: '🦊', name: 'Ann' })],
    };
    const drawn = draw(cardFromRoom(view, DATE));
    expect(drawn).toContain('🦊 Ann');
    const title = drawn.find((t) => t.startsWith('AAA'));
    expect(title?.endsWith('…')).toBe(true);
    expect([...title!].length * 20).toBeLessThanOrEqual(CARD_WIDTH - 120);
  });
});

describe('cardDate', () => {
  it('spells out the month, day first', () => {
    expect(cardDate(new Date(2026, 0, 3))).toBe('3 January 2026');
  });
});

describe('shareOrDownload', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: unknown; share?: unknown };

  afterEach(() => {
    Reflect.deleteProperty(nav, 'canShare');
    Reflect.deleteProperty(nav, 'share');
    vi.restoreAllMocks();
  });

  function stubDownload() {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
    return clicked;
  }

  it('shares the PNG as a file where the browser can share files', async () => {
    const shared: ShareData[] = [];
    nav.canShare = (data: ShareData) => Boolean(data.files?.length);
    nav.share = async (data: ShareData) => {
      shared.push(data);
    };
    const clicked = stubDownload();
    expect(await shareOrDownload(blob, 'share')).toBe('shared');
    expect(shared[0]?.files?.[0]).toMatchObject({ name: 'buzzr-results.png', type: 'image/png' });
    expect(clicked).toEqual([]);
  });

  it('downloads buzzr-results.png where files can’t be shared', async () => {
    const clicked = stubDownload();
    expect(await shareOrDownload(blob, 'share')).toBe('downloaded');
    expect(clicked).toEqual([{ href: 'blob:card', download: 'buzzr-results.png' }]);
  });

  it('downloads when sharing fails, but not when the player cancels the sheet', async () => {
    nav.canShare = () => true;
    nav.share = async () => {
      throw new DOMException('no activation', 'NotAllowedError');
    };
    const clicked = stubDownload();
    expect(await shareOrDownload(blob, 'share')).toBe('downloaded');
    nav.share = async () => {
      throw new DOMException('cancelled', 'AbortError');
    };
    expect(await shareOrDownload(blob, 'share')).toBe('cancelled');
    expect(clicked).toHaveLength(1);
  });

  it('downloads without the share sheet in download mode', async () => {
    const share = vi.fn();
    nav.canShare = () => true;
    nav.share = share;
    const clicked = stubDownload();
    expect(await shareOrDownload(blob, 'download')).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
  });
});
