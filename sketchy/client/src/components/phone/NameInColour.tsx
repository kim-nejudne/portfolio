import type { PlayerChipView } from '../../../../shared/types.js';

/**
 * A line of copy with a player's name written in their colour ("Waiting for 👑 Mika to start",
 * "✏️ Mika drawing"). Screen readers get the sentence whole from an `sr-only` copy; the coloured
 * one is `aria-hidden`, so the name isn't read as a separate piece. `say(name)` fills the copy:
 * called with a marker, it tells where the name goes.
 */
export function NameInColour({
  say,
  player,
}: {
  say: (name: string) => string;
  player: Pick<PlayerChipView, 'name' | 'color'> | undefined;
}) {
  const plain = say(player?.name ?? '');
  const parts = copyAround(say);
  if (!player || !parts) return <>{plain}</>;
  return (
    <>
      <span className="sr-only">{plain}</span>
      <span aria-hidden="true">
        {parts[0]}
        <span style={{ color: player.color }}>{player.name}</span>
        {parts[1]}
      </span>
    </>
  );
}

/** The text either side of `{var}` in a line of copy: `+{points} this turn` → `['+', ' this turn']`. */
export function copyAround(say: (marker: string) => string): [string, string] | null {
  const parts = say('\u0000').split('\u0000');
  return parts.length === 2 ? [parts[0]!, parts[1]!] : null;
}
