import type { PlayerChipView } from '../../../shared/types.js';

/**
 * A player's avatar (F53, sketchbook look F56): their emoji on paper inside a wobbly ring in their
 * colour, so the colour still tells two players with the same emoji apart. Used on every Screen
 * chip and the phone's "Who's here". Hidden from screen readers: the name beside it says who it is.
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
      className="wobbly inline-grid shrink-0 place-items-center border-solid bg-paper leading-none"
      style={{
        borderColor: player.color,
        // 2.4, 3.1 and 4.8 px at the mockup's 34, 64 and 132 px (2.5, 3 and 4 there).
        borderWidth: `calc(1.5px + ${size} * 0.025)`,
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.56)`,
      }}
    >
      {player.avatar}
    </span>
  );
}
