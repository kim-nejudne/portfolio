import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { visibleStrokes, type InkStack } from '../../../../shared/ink.js';
import type { PlayerChipView } from '../../../../shared/types.js';
import { DoodleContext } from '../../lib/doodles.js';
import { redrawPicture } from '../../lib/ink.js';

/** A doodle avatar's backing store: sharp at a TV chip's size, small enough for ten of them. */
const AVATAR_PX = 128;
/** Lines drawn this many times thicker, so an M stroke still reads at chip size. */
const AVATAR_LINE_SCALE = 6;

const noSubscribe = () => () => {};

/**
 * A player's avatar: their lobby doodle once their view says `hasDoodle` and this Screen holds it
 * (Screens only: phones have no doodles), else their initial in their colour.
 */
export function Avatar({ player, size = '1em' }: { player: PlayerChipView; size?: string }) {
  const doodles = useContext(DoodleContext);
  const getVersion = () => doodles?.version(player.pid) ?? 0;
  const version = useSyncExternalStore(doodles?.subscribe ?? noSubscribe, getVersion, getVersion);
  const stack = player.hasDoodle ? doodles?.get(player.pid) : undefined;
  if (stack && visibleStrokes(stack).length > 0)
    return <DoodleAvatar stack={stack} version={version} color={player.color} size={size} />;
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

function DoodleAvatar({
  stack,
  version,
  color,
  size,
}: {
  stack: InkStack;
  version: number;
  color: string;
  size: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) redrawPicture(ctx, stack, AVATAR_PX, AVATAR_LINE_SCALE);
  }, [stack, version]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      data-doodle
      width={AVATAR_PX}
      height={AVATAR_PX}
      className="box-border inline-block shrink-0 rounded-[22%] bg-white"
      style={{ width: size, height: size, border: `max(2px, calc(${size} * 0.07)) solid ${color}` }}
    />
  );
}

/**
 * A lobby chip: avatar and name, with the crown on the host. On the token Screen it is a button
 * (`onSelect`) that opens Give host crown and Kick for that player.
 */
export function LobbyChip({ player, onSelect }: { player: PlayerChipView; onSelect?: () => void }) {
  const inner = (
    <>
      <Avatar player={player} size="max(8vmin, 40px)" />
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
