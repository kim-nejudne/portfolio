import type { PublicPlayer } from '#shared/types.js';

/**
 * A Screen player tile (DESIGN.md "Player tile"). `wiggleSeq`: the practice fx to wiggle for; a new
 * one remounts the square to replay it. `lockedIn` fills it amber with "LOCKED IN" under the name.
 */
export function PlayerTile({
  player,
  wiggleSeq = null,
  lockedIn,
  compact = false,
}: {
  player: PublicPlayer;
  wiggleSeq?: number | null;
  /** Guessing only: the label row is laid out either way, so a tile locking in never shifts the rest. */
  lockedIn?: boolean;
  /** Picture-mode guessing: a 56 px square and 22 px text, so the row fits under the photo (DECISIONS 57). */
  compact?: boolean;
}) {
  return (
    <li
      data-locked-in={lockedIn || undefined}
      className={`flex flex-col items-center ${compact ? 'w-[128px] gap-1' : 'w-[200px] gap-3'} ${player.connected ? '' : 'opacity-40 grayscale'}`}
    >
      <span
        key={wiggleSeq ?? 'still'}
        data-wiggle={wiggleSeq !== null || undefined}
        className={`relative flex items-center justify-center rounded-card ${compact ? 'size-14 border-[3px] text-[32px]' : 'size-32 border-4 text-[64px]'} ${player.waiting ? 'border-dashed' : ''} ${wiggleSeq !== null ? 'tile-wiggle' : ''} ${lockedIn ? 'bg-amber' : ''}`}
        style={{ borderColor: player.color }}
      >
        <span aria-hidden="true">{player.emoji}</span>
        {player.isVip && (
          <span
            role="img"
            aria-label="VIP"
            className={`absolute flex items-center justify-center rounded-full bg-amber text-board-bg ${compact ? '-top-3 -right-3 size-7 text-[16px]' : '-top-5 -right-5 size-12 text-[28px]'}`}
          >
            ★
          </span>
        )}
      </span>
      <span
        className={`w-full text-center font-semibold break-words text-text ${compact ? 'truncate text-[22px]' : 'text-[24px]'}`}
      >
        {player.name}
      </span>
      {lockedIn !== undefined && (
        <span
          className={`board-face text-amber ${compact ? 'text-[22px]' : 'text-[24px]'} ${lockedIn ? '' : 'invisible'}`}
        >
          Locked in
        </span>
      )}
    </li>
  );
}
