import type { PublicPlayer } from '#shared/types.js';

/**
 * A Screen player tile (DESIGN.md "Player tile"). `wiggleSeq`: the practice fx to wiggle for; a new
 * one remounts the square to replay it. `lockedIn` fills it amber with "LOCKED IN" under the name.
 */
export function PlayerTile({
  player,
  wiggleSeq = null,
  lockedIn,
}: {
  player: PublicPlayer;
  wiggleSeq?: number | null;
  /** Guessing only: the label row is laid out either way, so a tile locking in never shifts the rest. */
  lockedIn?: boolean;
}) {
  return (
    <li
      data-locked-in={lockedIn || undefined}
      className={`flex w-[200px] flex-col items-center gap-3 ${player.connected ? '' : 'opacity-40 grayscale'}`}
    >
      <span
        key={wiggleSeq ?? 'still'}
        data-wiggle={wiggleSeq !== null || undefined}
        className={`relative flex size-32 items-center justify-center rounded-card border-4 text-[64px] ${player.waiting ? 'border-dashed' : ''} ${wiggleSeq !== null ? 'tile-wiggle' : ''} ${lockedIn ? 'bg-amber' : ''}`}
        style={{ borderColor: player.color }}
      >
        <span aria-hidden="true">{player.emoji}</span>
        {player.isVip && (
          <span
            role="img"
            aria-label="VIP"
            className="absolute -top-5 -right-5 flex size-12 items-center justify-center rounded-full bg-amber text-[28px] text-board-bg"
          >
            ★
          </span>
        )}
      </span>
      <span className="w-full text-center text-[24px] font-semibold break-words text-text">
        {player.name}
      </span>
      {lockedIn !== undefined && (
        <span className={`board-face text-[24px] text-amber ${lockedIn ? '' : 'invisible'}`}>
          Locked in
        </span>
      )}
    </li>
  );
}
