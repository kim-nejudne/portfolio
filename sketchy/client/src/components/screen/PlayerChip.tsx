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

/** A lobby chip: avatar and name, with the crown on the host. */
export function LobbyChip({ player }: { player: PlayerChipView }) {
  return (
    <li
      className={`flex items-center gap-[1vmin] rounded-[1.5vmin] border-2 px-[1.5vmin] py-[1vmin] ${
        player.connected ? 'border-white/20 bg-white/5' : 'border-white/10 opacity-60'
      }`}
    >
      <Avatar player={player} size="max(5vmin, 32px)" />
      <span className="truncate font-semibold" style={{ color: player.color }}>
        {player.crown && '👑'}
        {player.name}
      </span>
    </li>
  );
}
