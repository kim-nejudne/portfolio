import type { PlayerChipView } from '../../../../shared/types.js';

/** A player's avatar: their initial in their colour (lobby doodles replace it in F27). */
export function Avatar({ player, size = '1em' }: { player: PlayerChipView; size?: string }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-full leading-none font-bold text-[#1D1B22]"
      style={{
        background: player.color,
        width: size,
        height: size,
        fontSize: `calc(${size} * 0.55)`,
      }}
    >
      {[...player.name][0]?.toUpperCase()}
    </span>
  );
}

/**
 * A lobby chip: avatar and name, with the crown on the host. On the token Screen it is a button
 * (`onSelect`) that opens Give host crown and Kick for that player.
 */
export function LobbyChip({ player, onSelect }: { player: PlayerChipView; onSelect?: () => void }) {
  const inner = (
    <>
      <Avatar player={player} size="max(5vmin, 32px)" />
      <span className="truncate font-semibold" style={{ color: player.color }}>
        {player.crown && '👑 '}
        {player.name}
      </span>
    </>
  );
  const box = `flex items-center gap-[1vmin] rounded-[1.5vmin] border-2 px-[1.5vmin] py-[1vmin] ${
    player.connected ? 'border-white/20 bg-white/5' : 'border-white/10 opacity-60'
  }`;
  return (
    <li className="flex min-w-0">
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-haspopup="dialog"
          className={`${box} min-h-11 min-w-0 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white`}
        >
          {inner}
        </button>
      ) : (
        <span className={`${box} min-w-0`}>{inner}</span>
      )}
    </li>
  );
}
