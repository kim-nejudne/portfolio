import type { CSSProperties } from 'react';
import type { PlayerChipView } from '../../../../shared/types.js';
import type { ScreenLayout } from '../../lib/screen.js';
import { Avatar } from '../Avatar.js';

/** Up to this many players a landscape tab is tall enough for a name on two lines. */
export const TWO_LINE_TABS_MAX = 8;

/** Above this many players the portrait tabs go to two rows, so twelve names still fit. */
export const PORTRAIT_TABS_PER_ROW = 6;

/**
 * How much room the portrait tabs take above the code strip: one row, or two from 7 players, with
 * a floor so a propped-up phone's tabs still hold an avatar and a name.
 */
export function portraitTabsHeight(count: number): string {
  return count > PORTRAIT_TABS_PER_ROW ? 'max(16vmin, 6.5rem)' : 'max(13vmin, 4.5rem)';
}

/**
 * The players as index tabs on the notebook's edge (Sketchbook look, F62), in turn order (the
 * view's own order). Landscape: a column standing outside the book's right edge, each tab with a
 * crayon edge on the left; the rows share the height, so twelve fit. Portrait: equal-width tabs
 * along the bottom with the crayon edge on top, two rows from 7 players; names there are in vmin
 * (3.2, or 2.6 in two rows), since the spec's 3.5 vh is for a TV and six 3.5 vh names don't fit
 * across a portrait tablet (DECISIONS 85). On the token Screen in the lobby a tab is a button
 * (`onSelect`) that opens Give host crown and Kick for that player; it is exactly its row, which
 * on a phone used as the Screen with a full room is under 44 px (the host bar's Players opens the
 * same actions).
 */
export function PlayerTabs({
  players,
  layout,
  onSelect,
  crowns = true,
  className = '',
  style,
}: {
  players: PlayerChipView[];
  layout: ScreenLayout;
  onSelect?: (pid: string) => void;
  /** 👑 after the crown holder's name (the lobby). */
  crowns?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const portrait = layout === 'portrait';
  const twoRows = portrait && players.length > PORTRAIT_TABS_PER_ROW;
  // At least four columns, so two or three players get tabs, not banners.
  const perRow = Math.max(4, Math.min(players.length, PORTRAIT_TABS_PER_ROW));
  return (
    <ul
      data-tabs={layout}
      className={`grid ${portrait ? 'gap-[1.1vmin]' : 'content-start gap-[1.2vmin]'} ${className}`.trim()}
      style={{
        ...(portrait
          ? {
              gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
              gridTemplateRows: twoRows ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            }
          : // Each row is up to 8.6 vmin and they shrink together when the column runs out.
            { gridTemplateRows: `repeat(${players.length}, minmax(0, 8.6vmin))` }),
        ...style,
      }}
    >
      {players.map((p) => (
        <IndexTab
          key={p.pid}
          player={p}
          layout={layout}
          compact={twoRows}
          twoLines={!portrait && players.length <= TWO_LINE_TABS_MAX}
          crown={crowns && p.crown}
          {...(onSelect ? { onSelect: () => onSelect(p.pid) } : {})}
        />
      ))}
    </ul>
  );
}

/**
 * One index tab: `paper`, an `ink` border and a hard shadow, the player's colour as a thick edge
 * on the book's side (left in landscape, top in portrait), the avatar and the name. The name stays
 * level and `ink` (the crayon edge and the avatar ring carry the colour, as in the mockup).
 */
export function IndexTab({
  player,
  layout,
  compact = false,
  twoLines = false,
  crown = false,
  onSelect,
}: {
  player: PlayerChipView;
  layout: ScreenLayout;
  /** Portrait with two rows: avatar beside the name, smaller. */
  compact?: boolean;
  /** Landscape with room: a long name ("Marcus Aurelio") wraps to a second line, not an ellipsis. */
  twoLines?: boolean;
  crown?: boolean;
  onSelect?: () => void;
}) {
  const portrait = layout === 'portrait';
  const edge: CSSProperties = portrait
    ? { borderTopColor: player.color }
    : { borderLeftColor: player.color };
  const shape = portrait
    ? `border-[length:max(2px,0.28vmin)] border-t-[1.4vmin] rounded-b-[2vmin] px-[0.8vmin] ${
        compact
          ? 'gap-[0.8vmin] py-[0.4vmin] text-[max(2.6vmin,14px)]'
          : 'flex-col justify-center gap-[0.4vmin] py-[0.8vmin] text-center text-[max(3.2vmin,14px)]'
      }`
    : 'gap-[1.1vmin] border-[length:max(2px,0.28vmin)] border-l-[1.4vmin] rounded-r-[2vmin] py-[0.4vmin] text-left pr-[1.4vmin] pl-[1.6vmin] text-[max(3.6vmin,14px)]';
  const box = `flex size-full min-w-0 items-center overflow-hidden border-ink bg-paper leading-none text-ink shadow-[0.42vmin_0.42vmin_0_var(--color-ink)] ${shape} ${
    player.connected ? '' : 'opacity-60'
  }`;
  const inner = (
    <>
      {/* The crown sits on the avatar's shoulder, so it never costs the name its width; screen
          readers hear it after the name. */}
      <span aria-hidden className="relative inline-flex shrink-0">
        <Avatar player={player} size={portrait ? (compact ? '4vmin' : '5vmin') : '4.6vmin'} />
        {crown && (
          <span className="absolute -top-[0.45em] -right-[0.35em] text-[0.6em] leading-none">
            👑
          </span>
        )}
      </span>
      <span
        data-name
        className={`max-w-full min-w-0 ${twoLines ? 'line-clamp-2 leading-[0.95] wrap-anywhere' : 'truncate'}`}
      >
        {player.name}
        {crown && <span className="sr-only"> 👑</span>}
      </span>
    </>
  );
  return (
    <li data-tab={player.pid} className="flex min-h-0 min-w-0">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-haspopup="dialog"
          className={`${box} font-hand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen`}
          style={edge}
        >
          {inner}
        </button>
      ) : (
        <span className={box} style={edge}>
          {inner}
        </span>
      )}
    </li>
  );
}
