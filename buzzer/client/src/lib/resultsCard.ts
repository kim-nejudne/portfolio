import { APP_NAME, RESULTS_CARD_ROWS } from '../../../shared/constants.js';
import type { HostView, PlayerView, ScreenView, TopRows } from '../../../shared/types.js';
import { ordinal, podiumSteps, type PodiumStep } from './results.js';

// The results card (F78): a portrait PNG for the group chat, with the logo, set title, date,
// podium, the game's top 10 and, from game 2, the night's. Never the room code, so a shared card
// can't invite strangers into a live room (DECISIONS F78).

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const RESULTS_FILE = 'buzzr-results.png';

/** One ranked line on the card: a game score or a night total. */
export interface CardRow {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  points: number;
  rank: number;
}

export interface ResultsCardInput {
  title: string;
  date: Date;
  ranking: TopRows<CardRow>;
  /** From game 2; null in game 1. */
  tonight: TopRows<CardRow> | null;
}

/** The card's data from the Screen's or the remote's view, which carry every player. */
export function cardFromRoom(
  view: Pick<ScreenView | HostView, 'title' | 'players' | 'session'>,
  date: Date,
): ResultsCardInput {
  // The remote lists players in join order; a stable sort by rank keeps ties in join order.
  const ranked = [...view.players].sort((a, b) => a.rank - b.rank);
  const totals = view.session?.totals ?? [];
  return {
    title: view.title,
    date,
    ranking: { rows: ranked.map((p) => row(p, p.score)), count: ranked.length },
    tonight: view.session && {
      rows: totals.map((t) => row(t, t.total)),
      count: totals.length,
    },
  };
}

/** The card's data from the phone's view: in FINAL only, when the server sends `results`. */
export function cardFromPlayer(view: PlayerView, date: Date): ResultsCardInput | null {
  const { results } = view;
  if (!results) return null;
  return {
    title: results.title,
    date,
    ranking: {
      rows: results.ranking.rows.map((p) => row(p, p.score)),
      count: results.ranking.count,
    },
    tonight: results.tonight && {
      rows: results.tonight.rows.map((t) => row(t, t.total)),
      count: results.tonight.count,
    },
  };
}

function row(
  who: { id: string; name: string; color: string; avatar?: string; rank: number },
  points: number,
): CardRow {
  return {
    id: who.id,
    name: who.name,
    color: who.color,
    ...(who.avatar !== undefined && { avatar: who.avatar }),
    points,
    rank: who.rank,
  };
}

export interface CardLayout {
  podium: PodiumStep<CardRow>[];
  /** At most `RESULTS_CARD_ROWS` rows, and how many more there are. */
  ranking: { rows: CardRow[]; more: number };
  tonight: { rows: CardRow[]; more: number } | null;
}

/** What the card shows: the podium's steps and each ranking cut to its top 10. */
export function cardLayout(input: ResultsCardInput): CardLayout {
  return {
    podium: podiumSteps(input.ranking.rows),
    ranking: top(input.ranking),
    tonight: input.tonight && top(input.tonight),
  };
}

function top({ rows, count }: TopRows<CardRow>): { rows: CardRow[]; more: number } {
  const shown = rows.slice(0, RESULTS_CARD_ROWS);
  return { rows: shown, more: Math.max(0, count - shown.length) };
}

/** "29 October 2026": day first, month spelt out, so no reader mistakes it. */
export function cardDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** The drawing calls the card uses, so tests can record them without a real canvas. */
export type CardContext = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillRect'
  | 'fillText'
  | 'measureText'
  | 'beginPath'
  | 'moveTo'
  | 'arcTo'
  | 'arc'
  | 'closePath'
  | 'fill'
>;

// The `@theme` tokens in index.css; a canvas can't read CSS variables from a detached element.
const COLORS = {
  bg: '#0e0b2e',
  surface: '#1b1748',
  edge: '#2e2970',
  ink: '#ffffff',
  muted: '#b7b3e6',
  accent: '#ffc83d',
  accentInk: '#0e0b2e',
};
const DISPLAY = "Bungee, 'Arial Black', sans-serif";
const SANS = "'DM Sans', system-ui, sans-serif";

const MARGIN = 60;
const STEP_WIDTH = 280;
const STEP_GAP = 24;
const STEP_HEIGHTS = [200, 150, 110] as const;
const STEP_BOTTOM = 660;
/** Name lines above a step, "+N" included, and the highest they may go: clear of the date. */
const NAME_LINES = 4;
const NAME_LINE = 42;
export const NAMES_TOP = 340;
const RANKING_TOP = 720;
const ROW_HEIGHT = 48;

/** Draws the whole card on a `CARD_WIDTH` × `CARD_HEIGHT` context. */
export function drawResultsCard(ctx: CardContext, input: ResultsCardInput): void {
  const layout = cardLayout(input);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bulbRail(ctx, 36);
  bulbRail(ctx, CARD_HEIGHT - 36);

  text(ctx, APP_NAME, CARD_WIDTH / 2, 140, { font: `96px ${DISPLAY}`, color: COLORS.accent });
  text(ctx, input.title, CARD_WIDTH / 2, 232, {
    font: `700 48px ${SANS}`,
    color: COLORS.ink,
    maxWidth: CARD_WIDTH - 2 * MARGIN,
  });
  text(ctx, cardDate(input.date), CARD_WIDTH / 2, 290, {
    font: `400 32px ${SANS}`,
    color: COLORS.muted,
  });

  podium(ctx, layout.podium);

  if (layout.tonight) {
    const width = (CARD_WIDTH - 3 * MARGIN) / 2;
    rankingColumn(ctx, 'This game', layout.ranking, MARGIN, width);
    rankingColumn(ctx, 'Tonight', layout.tonight, 2 * MARGIN + width, width);
  } else {
    rankingColumn(ctx, 'Full ranking', layout.ranking, MARGIN, CARD_WIDTH - 2 * MARGIN);
  }
}

function podium(ctx: CardContext, steps: PodiumStep<CardRow>[]): void {
  const span = steps.length * STEP_WIDTH + (steps.length - 1) * STEP_GAP;
  steps.forEach((step, i) => {
    const x = (CARD_WIDTH - span) / 2 + i * (STEP_WIDTH + STEP_GAP);
    const height = STEP_HEIGHTS[step.height];
    const top = STEP_BOTTOM - height;
    const lit = step.height === 0;
    ctx.fillStyle = lit ? COLORS.accent : COLORS.edge;
    roundedRect(ctx, x, top, STEP_WIDTH, height, 20);
    const ink = lit ? COLORS.accentInk : COLORS.ink;
    text(ctx, ordinal(step.rank), x + STEP_WIDTH / 2, top + 48, {
      font: `56px ${DISPLAY}`,
      color: ink,
    });
    text(ctx, String(step.players[0]?.points ?? 0), x + STEP_WIDTH / 2, top + 92, {
      font: `32px ${DISPLAY}`,
      color: ink,
    });

    // Names stack upwards from the step; a crowded tie ends in "+N".
    const room = Math.min(NAME_LINES, Math.floor((top - 30 - NAMES_TOP) / NAME_LINE) + 1);
    const crowded = step.players.length > room;
    const shown = step.players.slice(0, crowded ? room - 1 : room);
    const lines = [
      ...shown.map(label),
      ...(crowded ? [`+${step.players.length - shown.length}`] : []),
    ];
    lines.reverse().forEach((line, j) => {
      text(ctx, line, x + STEP_WIDTH / 2, top - 30 - j * NAME_LINE, {
        font: `700 32px ${SANS}`,
        color: COLORS.ink,
        maxWidth: STEP_WIDTH + STEP_GAP,
      });
    });
  });
}

function rankingColumn(
  ctx: CardContext,
  heading: string,
  { rows, more }: { rows: CardRow[]; more: number },
  x: number,
  width: number,
): void {
  text(ctx, heading, x, RANKING_TOP, {
    font: `34px ${DISPLAY}`,
    color: COLORS.accent,
    align: 'left',
  });
  rows.forEach((r, i) => {
    const y = RANKING_TOP + 56 + i * ROW_HEIGHT;
    const leader = r.rank === 1;
    ctx.fillStyle = leader ? COLORS.accent : COLORS.surface;
    roundedRect(ctx, x, y - 21, width, 42, 12);
    const ink = leader ? COLORS.accentInk : COLORS.ink;
    text(ctx, ordinal(r.rank), x + 14, y, {
      font: `24px ${DISPLAY}`,
      color: leader ? ink : COLORS.muted,
      align: 'left',
    });
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(x + 92, y, 10, 0, 2 * Math.PI);
    ctx.fill();
    const pointsWidth = 120;
    text(ctx, label(r), x + 114, y, {
      font: `700 28px ${SANS}`,
      color: ink,
      align: 'left',
      maxWidth: width - 114 - pointsWidth - 14,
    });
    text(ctx, String(r.points), x + width - 14, y, {
      font: `26px ${DISPLAY}`,
      color: ink,
      align: 'right',
    });
  });
  if (more > 0) {
    text(ctx, `and ${more} more`, x + 14, RANKING_TOP + 56 + rows.length * ROW_HEIGHT + 10, {
      font: `400 28px ${SANS}`,
      color: COLORS.muted,
      align: 'left',
    });
  }
}

/** The avatar, when there is one, before the name. */
function label(r: CardRow): string {
  return r.avatar ? `${r.avatar} ${r.name}` : r.name;
}

function bulbRail(ctx: CardContext, y: number): void {
  const count = 18;
  const gap = (CARD_WIDTH - 2 * MARGIN) / (count - 1);
  ctx.fillStyle = COLORS.accent;
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.arc(MARGIN + i * gap, y, 9, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/** arcTo rather than `roundRect`, which older Safari lacks. */
function roundedRect(ctx: CardContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

interface TextStyle {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  maxWidth?: number;
}

function text(ctx: CardContext, value: string, x: number, y: number, style: TextStyle): void {
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? 'center';
  ctx.fillText(style.maxWidth ? fit(ctx, value, style.maxWidth) : value, x, y);
}

/** Cuts `value` to fit `maxWidth`, ending in "…" when anything was cut. */
function fit(ctx: CardContext, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  // By code point, so an emoji avatar is never split in half.
  const chars = [...value];
  while (chars.length > 0 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** Draws the card on a fresh canvas and encodes it as a PNG. */
export async function renderResultsCard(input: ResultsCardInput): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  drawResultsCard(ctx, input);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png');
  });
}

/** A canvas draws with whatever fonts are loaded; the page may not have used every weight yet. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all(
      [`96px Bungee`, `700 48px 'DM Sans'`, `400 32px 'DM Sans'`].map((f) =>
        document.fonts.load(f),
      ),
    );
  } catch {
    // The fallback fonts still give a readable card.
  }
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Shares the PNG through the share sheet where the browser can share files, otherwise downloads
 * it as `buzzr-results.png`. `download` skips the share sheet: the Screen is a laptop.
 */
export async function shareOrDownload(
  blob: Blob,
  mode: 'share' | 'download',
): Promise<ShareOutcome> {
  const file = new File([blob], RESULTS_FILE, { type: 'image/png' });
  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${APP_NAME} results` });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Otherwise (say, the tap's activation ran out while drawing), save the file instead.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = RESULTS_FILE;
  link.click();
  // Revoked later: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
