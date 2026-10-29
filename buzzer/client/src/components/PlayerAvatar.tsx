/**
 * A player's avatar emoji beside their name (F75), or nothing for a player without one, so their
 * row looks as it did before avatars. Hidden from screen readers: the name beside it says who it is.
 */
export function PlayerAvatar({ avatar, className = '' }: { avatar?: string; className?: string }) {
  if (avatar === undefined) return null;
  return (
    <span aria-hidden="true" data-avatar className={`shrink-0 leading-none ${className}`}>
      {avatar}
    </span>
  );
}
