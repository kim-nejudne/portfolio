import type { PlayerChipView } from '../../../shared/types.js';

/**
 * A player's avatar (F53): their emoji on a disc in their colour, so the colour still tells two
 * players with the same emoji apart. Used on every Screen chip and the phone's "Who's here".
 * Hidden from screen readers: the name beside it says who it is.
 */
export function Avatar({
  player,
  size = '1em',
}: {
  player: Pick<PlayerChipView, 'avatar' | 'color'>;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      data-avatar
      className="inline-grid shrink-0 place-items-center rounded-full leading-none"
      style={{
        background: player.color,
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.62)`,
      }}
    >
      {player.avatar}
    </span>
  );
}
